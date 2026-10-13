import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripBody, tripWithTeam } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

describe('trip routes require authentication', () => {
  it.each([
    ['post', '/api/trips'],
    ['get', '/api/trips'],
    ['get', '/api/trips/7d0c7a52-3c6b-4f5e-9a51-2b1f2b9e1c11'],
    ['patch', '/api/trips/7d0c7a52-3c6b-4f5e-9a51-2b1f2b9e1c11'],
    ['delete', '/api/trips/7d0c7a52-3c6b-4f5e-9a51-2b1f2b9e1c11'],
  ])('%s %s → 401', async (method, path) => {
    const res = await request(app)[method](path).send(tripBody).expect(401)
    expect(res.body.message).toBe('Authentication required to plan or create a trip')
  })

  it('does not create anything for an unauthenticated request', async () => {
    await request(app).post('/api/trips').send(tripBody).expect(401)
    expect(await prisma.trip.count()).toBe(0)
  })
})

describe('POST /api/trips', () => {
  it('makes the creator the team leader', async () => {
    const { user, token } = await signUp()
    const res = await request(app).post('/api/trips').set(auth(token)).send(tripBody).expect(201)

    expect(res.body.trip).toMatchObject({ ...tripBody, ownerId: user.id, role: 'LEADER', currency: 'INR', groupType: 'friends' })
    expect(res.body.trip.members).toEqual([expect.objectContaining({ id: user.id, role: 'LEADER' })])
  })

  it('ignores an ownerId sent by the client', async () => {
    const { user, token } = await signUp()
    const other = await signUp()
    const res = await request(app).post('/api/trips').set(auth(token)).send({ ...tripBody, ownerId: other.user.id }).expect(201)
    expect(res.body.trip.ownerId).toBe(user.id)
  })

  it('validates dates', async () => {
    const { token } = await signUp()
    const res = await request(app).post('/api/trips').set(auth(token)).send({ ...tripBody, endDate: '2026-11-01' }).expect(400)
    expect(res.body.details.endDate).toMatch(/on or after/)
  })
})

describe('role-based access on a trip', () => {
  it('rejects non-members with 403 and lists only my trips', async () => {
    const { trip } = await tripWithTeam()
    const stranger = await signUp()
    const res = await request(app).get(`/api/trips/${trip.id}`).set(auth(stranger.token)).expect(403)
    expect(res.body.code).toBe('NOT_A_MEMBER')
    await request(app).patch(`/api/trips/${trip.id}`).set(auth(stranger.token)).send({ name: 'Nope' }).expect(403)
    const list = await request(app).get('/api/trips').set(auth(stranger.token)).expect(200)
    expect(list.body.trips).toEqual([])
  })

  it('lets members view and edit trip details', async () => {
    const { member, trip } = await tripWithTeam()
    await request(app).get(`/api/trips/${trip.id}`).set(auth(member.token)).expect(200)
    const res = await request(app)
      .patch(`/api/trips/${trip.id}`)
      .set(auth(member.token))
      .send({ name: 'Jaipur Long Weekend', startDate: '2026-11-13', endDate: '2026-11-17' })
      .expect(200)
    expect(res.body.trip).toMatchObject({ name: 'Jaipur Long Weekend', startDate: '2026-11-13', role: 'MEMBER', budgetMinor: tripBody.budgetMinor })
  })

  it('does not accept a budget change through the details endpoint', async () => {
    const { leader, member, trip } = await tripWithTeam()
    for (const user of [member, leader]) {
      const res = await request(app).patch(`/api/trips/${trip.id}`).set(auth(user.token)).send({ budgetMinor: 1 }).expect(400)
      expect(JSON.stringify(res.body.details)).toMatch(/Only the team leader can change the budget/)
    }
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).budgetMinor).toBe(BigInt(tripBody.budgetMinor))
  })

  it('only the leader can set the budget', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const denied = await request(app).patch(`/api/trips/${trip.id}/budget`).set(auth(member.token)).send({ budgetMinor: 5000000 }).expect(403)
    expect(denied.body).toMatchObject({ code: 'LEADER_ONLY', message: 'Only the team leader can set the trip budget.' })

    const ok = await request(app).patch(`/api/trips/${trip.id}/budget`).set(auth(leader.token)).send({ budgetMinor: 5000000 }).expect(200)
    expect(ok.body.trip.budgetMinor).toBe(5000000)
    await request(app).patch(`/api/trips/${trip.id}/budget`).set(auth(leader.token)).send({ budgetMinor: -1 }).expect(400)
  })

  it('only the leader can delete the trip', async () => {
    const { leader, member, trip } = await tripWithTeam()
    await request(app).delete(`/api/trips/${trip.id}`).set(auth(member.token)).expect(403)
    await request(app).delete(`/api/trips/${trip.id}`).set(auth(leader.token)).expect(204)
    expect(await prisma.trip.count()).toBe(0)
  })

  it('only the leader removes members; members can leave; the leader cannot', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const third = await signUp()
    await prisma.tripMember.create({ data: { tripId: trip.id, userId: third.user.id, role: 'MEMBER' } })

    await request(app).delete(`/api/trips/${trip.id}/members/${third.user.id}`).set(auth(member.token)).expect(403)
    await request(app).delete(`/api/trips/${trip.id}/members/${third.user.id}`).set(auth(leader.token)).expect(204)
    await request(app).delete(`/api/trips/${trip.id}/members/${leader.user.id}`).set(auth(leader.token)).expect(400)
    await request(app).delete(`/api/trips/${trip.id}/members/${member.user.id}`).set(auth(member.token)).expect(204)
  })
})

describe('GET /api/trips card stats', () => {
  it('includes the place count and total spent, so cards are right on any device', async () => {
    const t = await tripWithTeam()
    for (const name of ['Amber Fort', 'Hawa Mahal']) {
      await request(app).post(`/api/trips/${t.trip.id}/places`).set(auth(t.member.token)).send({ name, lat: 26.9, lng: 75.8 }).expect(201)
    }
    for (const amountMinor of [10000, 2550]) {
      await request(app)
        .post(`/api/trips/${t.trip.id}/expenses`)
        .set(auth(t.leader.token))
        .set('Idempotency-Key', `stats-${amountMinor}-${Date.now()}`)
        .send({ title: 'Snacks', amountMinor, paidBy: t.leader.user.id, splitType: 'EQUAL', category: 'food', participants: [{ userId: t.leader.user.id }] })
        .expect(201)
    }
    const res = await request(app).get('/api/trips').set(auth(t.member.token)).expect(200)
    expect(res.body.trips[0].stats).toEqual({ placeCount: 2, spentMinor: 12550 })

    const empty = await request(app).post('/api/trips').set(auth(t.member.token)).send({ ...tripBody, name: 'Empty one' }).expect(201)
    const again = await request(app).get('/api/trips').set(auth(t.member.token)).expect(200)
    expect(again.body.trips.find((x) => x.id === empty.body.trip.id).stats).toEqual({ placeCount: 0, spentMinor: 0 })
  })
})

describe('health and caching', () => {
  it('serves /health and /api/health (the latter shows the client IP for proxy checks)', async () => {
    const plain = await request(app).get('/health').expect(200)
    expect(plain.body).toEqual({ status: 'ok', database: 'up' })
    const viaApi = await request(app).get('/api/health').set('X-Forwarded-For', '203.0.113.9').expect(200)
    expect(viaApi.body).toMatchObject({ status: 'ok', database: 'up', yourIp: expect.any(String) })
  })

  it('marks API responses as never cacheable by proxies', async () => {
    const { token } = await signUp()
    const res = await request(app).get('/api/trips').set(auth(token)).expect(200)
    expect(res.headers['cache-control']).toBe('no-store')
  })
})
