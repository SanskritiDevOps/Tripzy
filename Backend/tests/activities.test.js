import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

const place = { name: 'Amber Fort', address: 'Amer, Jaipur', lat: 26.9855, lng: 75.8513, category: 'sight' }

const feed = (trip, user, query = '') => request(app).get(`/api/trips/${trip.id}/activities${query}`).set(auth(user.token))

async function addPlace(trip, user, body = place) {
  const res = await request(app).post(`/api/trips/${trip.id}/places`).set(auth(user.token)).send(body).expect(201)
  return res.body.place
}

describe('activity log', () => {
  it('records trip creation with the creator', async () => {
    const { leader, trip } = await tripWithTeam()
    const res = await feed(trip, leader).expect(200)
    expect(res.body.activities.at(-1)).toMatchObject({
      action: 'TRIP_CREATED',
      user: { id: leader.user.id, name: leader.user.name, email: leader.user.email },
      message: `${leader.user.name} created the trip`,
    })
  })

  it('records place add, edit, lock, unlock and delete — newest first, with who did it', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const p = await addPlace(trip, member)
    await request(app).patch(`/api/trips/${trip.id}/places/${p.id}`).set(auth(member.token)).send({ notes: 'Go early' }).expect(200)
    await request(app).patch(`/api/trips/${trip.id}/places/${p.id}/lock`).set(auth(leader.token)).send({ locked: true }).expect(200)
    await request(app).patch(`/api/trips/${trip.id}/places/${p.id}/lock`).set(auth(leader.token)).send({ locked: false }).expect(200)
    await request(app).delete(`/api/trips/${trip.id}/places/${p.id}`).set(auth(member.token)).expect(204)

    const { body } = await feed(trip, member).expect(200)
    const recent = body.activities.slice(0, 5).map((a) => [a.action, a.user.id, a.message])
    expect(recent).toEqual([
      ['PLACE_DELETED', member.user.id, `${member.user.name} removed Amber Fort`],
      ['PLACE_UNLOCKED', leader.user.id, `${leader.user.name} unlocked Amber Fort`],
      ['PLACE_LOCKED', leader.user.id, `${leader.user.name} locked Amber Fort`],
      ['PLACE_UPDATED', member.user.id, `${member.user.name} edited Amber Fort`],
      ['PLACE_ADDED', member.user.id, `${member.user.name} added Amber Fort`],
    ])
    expect(body.activities[3].details.fields).toEqual(['notes'])
    // Timestamps are descending.
    const times = body.activities.map((a) => a.createdAt)
    expect([...times].sort().reverse()).toEqual(times)
  })

  it('records budget changes with the amount, and trip detail edits with the changed fields', async () => {
    const { leader, member, trip } = await tripWithTeam()
    await request(app).patch(`/api/trips/${trip.id}/budget`).set(auth(leader.token)).send({ budgetMinor: 8000000 }).expect(200)
    await request(app).patch(`/api/trips/${trip.id}`).set(auth(member.token)).send({ name: 'Jaipur Long Weekend', startDate: '2026-11-13', endDate: '2026-11-17' }).expect(200)

    const [edit, budget] = (await feed(trip, leader).expect(200)).body.activities
    expect(budget).toMatchObject({ action: 'BUDGET_UPDATED', details: { from: 12000000, to: 8000000 }, message: `${leader.user.name} updated the trip budget to ₹80,000` })
    expect(edit).toMatchObject({ action: 'TRIP_UPDATED', user: { id: member.user.id } })
    expect(edit.details.fields.sort()).toEqual(['name', 'startDate'])
    expect(edit.details.changes.name).toEqual({ from: 'Jaipur Royal Weekend', to: 'Jaipur Long Weekend' })
    expect(edit.message).toBe(`${member.user.name} updated the trip name, dates`)
  })

  it('does not log no-op changes', async () => {
    const { leader, trip } = await tripWithTeam()
    const p = await addPlace(trip, leader)
    const before = await prisma.tripActivity.count()
    await request(app).patch(`/api/trips/${trip.id}`).set(auth(leader.token)).send({ name: trip.name }).expect(200)
    await request(app).patch(`/api/trips/${trip.id}/budget`).set(auth(leader.token)).send({ budgetMinor: trip.budgetMinor }).expect(200)
    await request(app).patch(`/api/trips/${trip.id}/places/${p.id}/lock`).set(auth(leader.token)).send({ locked: false }).expect(200)
    expect(await prisma.tripActivity.count()).toBe(before)
  })

  it('records invites, joins, leaving and removals', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const invite = await request(app).post(`/api/trips/${trip.id}/invites`).set(auth(leader.token)).send({ email: 'guest@example.com' }).expect(201)
    const guest = await signUp({ email: 'guest@example.com', name: 'Gita Guest' })
    await request(app).post('/api/trips/join').set(auth(guest.token)).send({ token: new URL(invite.body.inviteUrl).searchParams.get('token') }).expect(200)
    await request(app).delete(`/api/trips/${trip.id}/members/${member.user.id}`).set(auth(leader.token)).expect(204)
    await request(app).delete(`/api/trips/${trip.id}/members/${guest.user.id}`).set(auth(guest.token)).expect(204)

    const actions = (await feed(trip, leader).expect(200)).body.activities.slice(0, 4)
    expect(actions.map((a) => a.action)).toEqual(['MEMBER_LEFT', 'MEMBER_REMOVED', 'MEMBER_JOINED', 'INVITE_SENT'])
    expect(actions[1].message).toBe(`${leader.user.name} removed ${member.user.name} from the trip`)
    expect(actions[2].message).toBe('Gita Guest joined the trip')
    expect(actions[3].details).toEqual({ email: 'guest@example.com' })
  })

  it('a rejected action (member deleting a locked place) is not logged', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const p = await addPlace(trip, leader)
    await request(app).patch(`/api/trips/${trip.id}/places/${p.id}/lock`).set(auth(leader.token)).send({ locked: true }).expect(200)
    const before = await prisma.tripActivity.count()
    await request(app).delete(`/api/trips/${trip.id}/places/${p.id}`).set(auth(member.token)).expect(403)
    expect(await prisma.tripActivity.count()).toBe(before)
    expect(await prisma.place.count()).toBe(1)
  })

  it('keeps the place name after the place is deleted', async () => {
    const { leader, trip } = await tripWithTeam()
    const p = await addPlace(trip, leader)
    await request(app).delete(`/api/trips/${trip.id}/places/${p.id}`).set(auth(leader.token)).expect(204)
    const added = (await feed(trip, leader)).body.activities.find((a) => a.action === 'PLACE_ADDED')
    expect(added.message).toBe(`${leader.user.name} added Amber Fort`)
  })

  it('paginates with a cursor (default 30, newest first)', async () => {
    const { leader, trip } = await tripWithTeam()
    for (let i = 0; i < 34; i++) await addPlace(trip, leader, { ...place, name: `Stop ${String(i).padStart(2, '0')}` })

    const first = (await feed(trip, leader).expect(200)).body
    expect(first.activities).toHaveLength(30)
    expect(first.activities[0].message).toContain('Stop 33')
    expect(first.nextCursor).toBe(first.activities.at(-1).id)

    const second = (await feed(trip, leader, `?before=${first.nextCursor}`).expect(200)).body
    expect(second.activities).toHaveLength(5) // 4 more places + TRIP_CREATED
    expect(second.activities.at(-1).action).toBe('TRIP_CREATED')
    expect(second.nextCursor).toBeNull()
    const ids = new Set([...first.activities, ...second.activities].map((a) => a.id))
    expect(ids.size).toBe(35)

    const small = (await feed(trip, leader, '?limit=2').expect(200)).body
    expect(small.activities).toHaveLength(2)
    await feed(trip, leader, '?limit=500').expect(400)
  })

  it('is visible to members only', async () => {
    const { trip } = await tripWithTeam()
    const stranger = await signUp()
    await feed(trip, stranger).expect(403)
    await request(app).get(`/api/trips/${trip.id}/activities`).expect(401)
  })

  it('entries are removed with the trip', async () => {
    const { leader, trip } = await tripWithTeam()
    await addPlace(trip, leader)
    await request(app).delete(`/api/trips/${trip.id}`).set(auth(leader.token)).expect(204)
    expect(await prisma.tripActivity.count({ where: { tripId: trip.id } })).toBe(0)
  })
})
