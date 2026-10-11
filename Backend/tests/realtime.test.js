import http from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { io as connectClient } from 'socket.io-client'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { createSocketServer } from '../src/realtime/socket.js'

let server
let io
let url
const clients = []

beforeAll(async () => {
  server = http.createServer(app)
  io = await createSocketServer(server)
  await new Promise((resolve) => server.listen(0, resolve))
  url = `http://localhost:${server.address().port}`
})

afterEach(() => {
  while (clients.length) clients.pop().disconnect()
})

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve))
})

/** Resolves with a connected socket, or rejects with the handshake error. */
function connect(token) {
  const socket = connectClient(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, forceNew: true })
  clients.push(socket)
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

const join = (socket, tripId) => socket.timeout(2000).emitWithAck('trip:join', { tripId })

function next(socket, event, predicate = () => true, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`no ${event} within ${ms}ms`))
    }, ms)
    function handler(payload) {
      if (!predicate(payload)) return
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(payload)
    }
    socket.on(event, handler)
  })
}

/** Collects every `event` the socket receives during `ms`. */
function collect(socket, event, ms = 300) {
  const seen = []
  const handler = (payload) => seen.push(payload)
  socket.on(event, handler)
  return new Promise((resolve) =>
    setTimeout(() => {
      socket.off(event, handler)
      resolve(seen)
    }, ms),
  )
}

const place = { name: 'Amber Fort', lat: 26.9855, lng: 75.8513, category: 'sight', durationMinutes: 120 }

describe('realtime: connection auth', () => {
  it('rejects a handshake without a token', async () => {
    await expect(connect()).rejects.toMatchObject({ data: { code: 'AUTH_REQUIRED' } })
  })

  it('rejects an invalid token', async () => {
    await expect(connect('not-a-jwt')).rejects.toMatchObject({ data: { code: 'INVALID_TOKEN' } })
  })

  it('accepts a valid access token', async () => {
    const user = await signUp()
    const socket = await connect(user.token)
    expect(socket.connected).toBe(true)
  })
})

describe('realtime: trip rooms', () => {
  it('only lets members join a trip room', async () => {
    const { member, trip } = await tripWithTeam()
    const outsider = await signUp()

    const ok = await join(await connect(member.token), trip.id)
    expect(ok).toMatchObject({ ok: true, onlineUserIds: [member.user.id] })

    const denied = await join(await connect(outsider.token), trip.id)
    expect(denied).toMatchObject({ ok: false, code: 'NOT_A_MEMBER' })

    const invalid = await join(await connect(outsider.token), 'nope')
    expect(invalid).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' })
  })

  it('broadcasts presence as members come and go', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const leaderSocket = await connect(leader.token)
    await join(leaderSocket, trip.id)

    const bothOnline = next(leaderSocket, 'trip:presence', (p) => p.onlineUserIds.length === 2)
    const memberSocket = await connect(member.token)
    await join(memberSocket, trip.id)
    expect((await bothOnline).onlineUserIds.sort()).toEqual([leader.user.id, member.user.id].sort())

    const memberGone = next(leaderSocket, 'trip:presence', (p) => p.onlineUserIds.length === 1)
    memberSocket.disconnect()
    expect((await memberGone).onlineUserIds).toEqual([leader.user.id])
  })
})

describe('realtime: change broadcasts', () => {
  it('tells other members what changed, with who changed it — but not the tab that made the change', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const leaderSocket = await connect(leader.token)
    const memberSocket = await connect(member.token)
    await join(leaderSocket, trip.id)
    await join(memberSocket, trip.id)

    const memberSees = next(memberSocket, 'trip:changed')
    const leaderSeen = collect(leaderSocket, 'trip:changed', 400)
    await request(app).post(`/api/trips/${trip.id}/places`).set(auth(leader.token)).set('X-Socket-Id', leaderSocket.id).send(place).expect(201)

    expect(await memberSees).toMatchObject({ tripId: trip.id, scopes: ['places', 'itinerary'], actor: { id: leader.user.id, name: leader.user.name } })
    expect(await leaderSeen).toEqual([])
  })

  it('maps each kind of change to the data clients must re-fetch', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const memberSocket = await connect(member.token)
    await join(memberSocket, trip.id)
    const as = auth(leader.token)

    const cases = [
      [() => request(app).patch(`/api/trips/${trip.id}/budget`).set(as).send({ budgetMinor: 5000000 }), ['trip']],
      [() => request(app).patch(`/api/trips/${trip.id}`).set(as).send({ name: 'Renamed' }), ['trip', 'itinerary']],
      [() => request(app).post(`/api/trips/${trip.id}/packing`).set(as).send({ label: 'Sunscreen', category: 'toiletries' }), ['packing']],
      [() => request(app).post(`/api/trips/${trip.id}/voting/close`).set(as), ['trip', 'places']],
    ]
    for (const [send, scopes] of cases) {
      const event = next(memberSocket, 'trip:changed')
      const res = await send()
      expect(res.status).toBeLessThan(300)
      expect((await event).scopes).toEqual(scopes)
    }
  })

  it('does not broadcast reads or rejected writes', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const leaderSocket = await connect(leader.token)
    await join(leaderSocket, trip.id)

    const seen = collect(leaderSocket, 'trip:changed', 500)
    await request(app).get(`/api/trips/${trip.id}/places`).set(auth(member.token)).expect(200)
    await request(app).patch(`/api/trips/${trip.id}/budget`).set(auth(member.token)).send({ budgetMinor: 1 }).expect(403)
    await request(app).post(`/api/trips/${trip.id}/places`).set(auth(member.token)).send({ name: '' }).expect(400)
    expect(await seen).toEqual([])
  })

  it('never sends a trip’s updates to non-members', async () => {
    const { leader, trip } = await tripWithTeam()
    const outsider = await signUp()
    const outsiderSocket = await connect(outsider.token)
    await join(outsiderSocket, trip.id) // refused

    const seen = collect(outsiderSocket, 'trip:changed', 400)
    await request(app).post(`/api/trips/${trip.id}/places`).set(auth(leader.token)).send(place).expect(201)
    expect(await seen).toEqual([])
  })
})

describe('realtime: losing access', () => {
  it('removes a kicked member from the room and tells them', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const leaderSocket = await connect(leader.token)
    const memberSocket = await connect(member.token)
    await join(leaderSocket, trip.id)
    await join(memberSocket, trip.id)

    const revoked = next(memberSocket, 'trip:access-revoked')
    const leaderSees = next(leaderSocket, 'trip:changed')
    const presence = next(leaderSocket, 'trip:presence', (p) => p.onlineUserIds.length === 1)
    await request(app).delete(`/api/trips/${trip.id}/members/${member.user.id}`).set(auth(leader.token)).expect(204)

    expect(await revoked).toMatchObject({ tripId: trip.id, reason: 'removed', actor: { id: leader.user.id } })
    expect((await leaderSees).scopes).toEqual(['trip'])
    expect((await presence).onlineUserIds).toEqual([leader.user.id])

    // No further updates reach the removed member.
    const seen = collect(memberSocket, 'trip:changed', 400)
    await request(app).post(`/api/trips/${trip.id}/places`).set(auth(leader.token)).send(place).expect(201)
    expect(await seen).toEqual([])
  })

  it('tells everyone when the leader deletes the trip', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const memberSocket = await connect(member.token)
    await join(memberSocket, trip.id)

    const deleted = next(memberSocket, 'trip:deleted')
    await request(app).delete(`/api/trips/${trip.id}`).set(auth(leader.token)).expect(204)
    expect(await deleted).toMatchObject({ tripId: trip.id, actor: { id: leader.user.id } })
  })

  it('announces a new member who joins by invite', async () => {
    const leader = await signUp()
    const res = await request(app)
      .post('/api/trips')
      .set(auth(leader.token))
      .send({ name: 'Goa', destination: 'Goa', startDate: '2026-12-01', endDate: '2026-12-02' })
      .expect(201)
    const tripId = res.body.trip.id
    const leaderSocket = await connect(leader.token)
    await join(leaderSocket, tripId)

    const invite = await request(app).post(`/api/trips/${tripId}/invites`).set(auth(leader.token)).send({ email: 'newbie@example.com' }).expect(201)
    const newbie = await signUp({ email: 'newbie@example.com', name: 'New Bie' })
    const announced = next(leaderSocket, 'trip:changed', (e) => e.actor.id === newbie.user.id)
    const token = new URL(invite.body.inviteUrl).searchParams.get('token')
    await request(app).post('/api/trips/join').set(auth(newbie.token)).send({ token }).expect(200)
    expect(await announced).toMatchObject({ scopes: ['trip'], actor: { name: 'New Bie' } })
  })
})
