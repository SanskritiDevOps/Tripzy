import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

const LOCKED = 'This place is locked by the team leader and cannot be modified.'
const amberFort = { name: 'Amber Fort', address: 'Amer, Jaipur', lat: 26.9855, lng: 75.8513, category: 'sight', durationMinutes: 180 }

async function addPlace(trip, user, body = amberFort) {
  const res = await request(app).post(`/api/trips/${trip.id}/places`).set(auth(user.token)).send(body).expect(201)
  return res.body.place
}

const lock = (trip, place, user, locked = true) =>
  request(app).patch(`/api/trips/${trip.id}/places/${place.id}/lock`).set(auth(user.token)).send({ locked })

describe('places: any member can add, edit and delete unlocked places', () => {
  it('creates a place attributed to the member', async () => {
    const { member, trip } = await tripWithTeam()
    const place = await addPlace(trip, member)
    expect(place).toMatchObject({ ...amberFort, tripId: trip.id, addedBy: member.user.id, isLocked: false, notes: '' })

    const list = await request(app).get(`/api/trips/${trip.id}/places`).set(auth(member.token)).expect(200)
    expect(list.body.places).toHaveLength(1)
  })

  it('lets a member edit and delete a place someone else added', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const place = await addPlace(trip, leader)
    const res = await request(app).patch(`/api/trips/${trip.id}/places/${place.id}`).set(auth(member.token)).send({ notes: 'Go early' }).expect(200)
    expect(res.body.place.notes).toBe('Go early')
    await request(app).delete(`/api/trips/${trip.id}/places/${place.id}`).set(auth(member.token)).expect(204)
  })

  it('validates input and refuses to change isLocked through PATCH', async () => {
    const { member, trip } = await tripWithTeam()
    await request(app).post(`/api/trips/${trip.id}/places`).set(auth(member.token)).send({ name: 'X', lat: 200 }).expect(400)
    const place = await addPlace(trip, member)
    await request(app).patch(`/api/trips/${trip.id}/places/${place.id}`).set(auth(member.token)).send({ isLocked: true }).expect(400)
  })

  it('hides places from non-members', async () => {
    const { leader, trip } = await tripWithTeam()
    await addPlace(trip, leader)
    const stranger = await signUp()
    await request(app).get(`/api/trips/${trip.id}/places`).set(auth(stranger.token)).expect(403)
  })

  it('cannot reach a place through a different trip id', async () => {
    const team1 = await tripWithTeam()
    const team2 = await tripWithTeam()
    const place = await addPlace(team1.trip, team1.leader)
    await request(app).patch(`/api/trips/${team2.trip.id}/places/${place.id}`).set(auth(team2.leader.token)).send({ notes: 'x' }).expect(404)
  })
})

describe('places: locking', () => {
  it('only the leader can lock and unlock', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const place = await addPlace(trip, member)

    const denied = await lock(trip, place, member).expect(403)
    expect(denied.body.code).toBe('LEADER_ONLY')

    const locked = await lock(trip, place, leader).expect(200)
    expect(locked.body.place).toMatchObject({ isLocked: true, lockedById: leader.user.id, lockedAt: expect.any(String) })

    const unlocked = await lock(trip, place, leader, false).expect(200)
    expect(unlocked.body.place).toMatchObject({ isLocked: false, lockedById: null })
  })

  it('a member cannot edit or delete a locked place (403 with the lock message)', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const place = await addPlace(trip, member)
    await lock(trip, place, leader).expect(200)

    const edit = await request(app).patch(`/api/trips/${trip.id}/places/${place.id}`).set(auth(member.token)).send({ notes: 'sneaky' }).expect(403)
    expect(edit.body).toEqual({ message: LOCKED, code: 'PLACE_LOCKED' })
    const del = await request(app).delete(`/api/trips/${trip.id}/places/${place.id}`).set(auth(member.token)).expect(403)
    expect(del.body.message).toBe(LOCKED)

    const stored = await prisma.place.findUnique({ where: { id: place.id } })
    expect(stored.notes).toBe('')
  })

  it('the leader can still edit and delete a locked place', async () => {
    const { leader, trip } = await tripWithTeam()
    const place = await addPlace(trip, leader)
    await lock(trip, place, leader).expect(200)
    await request(app).patch(`/api/trips/${trip.id}/places/${place.id}`).set(auth(leader.token)).send({ notes: 'Booked' }).expect(200)
    await request(app).delete(`/api/trips/${trip.id}/places/${place.id}`).set(auth(leader.token)).expect(204)
  })
})
