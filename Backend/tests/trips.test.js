import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

const tripBody = {
  name: 'Jaipur Royal Weekend',
  destination: 'Jaipur, Rajasthan',
  startDate: '2026-11-14',
  endDate: '2026-11-17',
  budgetMinor: 12000000,
}

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
  it('makes the authenticated user the owner', async () => {
    const { user, token } = await signUp()
    const res = await request(app).post('/api/trips').set(auth(token)).send(tripBody).expect(201)

    expect(res.body.trip).toMatchObject({ ...tripBody, ownerId: user.id, role: 'OWNER', currency: 'INR', groupType: 'friends' })
    expect(res.body.trip.members).toEqual([expect.objectContaining({ id: user.id, role: 'OWNER' })])
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

describe('membership and ownership', () => {
  async function tripOwnedByNewUser() {
    const owner = await signUp()
    const res = await request(app).post('/api/trips').set(auth(owner.token)).send(tripBody).expect(201)
    return { owner, trip: res.body.trip }
  }

  it('hides trips from non-members (404) and lists only my trips', async () => {
    const { trip } = await tripOwnedByNewUser()
    const stranger = await signUp()
    await request(app).get(`/api/trips/${trip.id}`).set(auth(stranger.token)).expect(404)
    const list = await request(app).get('/api/trips').set(auth(stranger.token)).expect(200)
    expect(list.body.trips).toEqual([])
  })

  it('lets members read but only the owner edit or delete', async () => {
    const { owner, trip } = await tripOwnedByNewUser()
    const member = await signUp()
    await prisma.tripMember.create({ data: { tripId: trip.id, userId: member.user.id, role: 'MEMBER' } })

    await request(app).get(`/api/trips/${trip.id}`).set(auth(member.token)).expect(200)
    await request(app).patch(`/api/trips/${trip.id}`).set(auth(member.token)).send({ name: 'Hijacked' }).expect(403)
    await request(app).delete(`/api/trips/${trip.id}`).set(auth(member.token)).expect(403)

    const updated = await request(app).patch(`/api/trips/${trip.id}`).set(auth(owner.token)).send({ name: 'Jaipur Long Weekend' }).expect(200)
    expect(updated.body.trip.name).toBe('Jaipur Long Weekend')
    expect(updated.body.trip.budgetMinor).toBe(tripBody.budgetMinor)

    await request(app).delete(`/api/trips/${trip.id}`).set(auth(owner.token)).expect(204)
    expect(await prisma.trip.count()).toBe(0)
  })

  it('lets a member leave but not the owner', async () => {
    const { owner, trip } = await tripOwnedByNewUser()
    const member = await signUp()
    await prisma.tripMember.create({ data: { tripId: trip.id, userId: member.user.id, role: 'MEMBER' } })

    await request(app).delete(`/api/trips/${trip.id}/members/${owner.user.id}`).set(auth(owner.token)).expect(400)
    await request(app).delete(`/api/trips/${trip.id}/members/${member.user.id}`).set(auth(member.token)).expect(204)
  })
})
