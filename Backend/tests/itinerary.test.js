import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

const LOCKED = 'This stop is locked by the team leader and cannot be modified.'

async function setup() {
  const team = await tripWithTeam()
  const base = `/api/trips/${team.trip.id}`
  const mkPlace = async (name) =>
    (await request(app).post(`${base}/places`).set(auth(team.leader.token)).send({ name, lat: 26.9, lng: 75.8, category: 'sight' }).expect(201)).body.place
  const amber = await mkPlace('Amber Fort')
  const hawa = await mkPlace('Hawa Mahal')
  const jal = await mkPlace('Jal Mahal')
  const days = (await request(app).get(`${base}/itinerary`).set(auth(team.member.token)).expect(200)).body.days
  return { ...team, base, amber, hawa, jal, days }
}

const addStop = (t, user, body) => request(app).post(`${t.base}/itinerary/items`).set(auth(user.token)).send({ dayId: t.days[0].id, durationMinutes: 60, ...body })
const itinerary = async (t, user) => (await request(app).get(`${t.base}/itinerary`).set(auth(user.token)).expect(200)).body.days

describe('itinerary: shared days and stops', () => {
  it('creates one day per trip date and keeps them in sync with the dates', async () => {
    const t = await setup()
    expect(t.days.map((d) => [d.dayNumber, d.date])).toEqual([
      [1, '2026-11-14'],
      [2, '2026-11-15'],
      [3, '2026-11-16'],
      [4, '2026-11-17'],
    ])
    await addStop(t, t.member, { dayId: t.days[3].id, placeId: t.amber.id, startTime: '10:00' }).expect(201)
    // Shorten to 3 days: day 4 and its stop go away; the dates shift.
    await request(app).patch(t.base).set(auth(t.member.token)).send({ startDate: '2026-11-15', endDate: '2026-11-17' }).expect(200)
    const days = await itinerary(t, t.leader)
    expect(days.map((d) => d.date)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17'])
    expect(await prisma.itineraryItem.count()).toBe(0)
  })

  it('a stop added by one member is visible to all, ordered by start time', async () => {
    const t = await setup()
    await addStop(t, t.member, { placeId: t.hawa.id, startTime: '14:00' }).expect(201)
    await addStop(t, t.leader, { placeId: t.amber.id, startTime: '09:00', notes: 'Go early', costMinor: 50000 }).expect(201)
    const [day1] = await itinerary(t, t.member)
    expect(day1.items.map((i) => [i.placeId, i.position, i.startTime])).toEqual([
      [t.amber.id, 0, '09:00'],
      [t.hawa.id, 1, '14:00'],
    ])
    expect(day1.items[0]).toMatchObject({ notes: 'Go early', costMinor: 50000, source: 'MANUAL', version: 1, createdById: t.leader.user.id })
  })

  it('validates the stop and that the day belongs to the trip', async () => {
    const t = await setup()
    await addStop(t, t.member, { placeId: t.amber.id, startTime: '25:00' }).expect(400)
    const other = await tripWithTeam()
    const otherDays = await itinerary({ base: `/api/trips/${other.trip.id}` }, other.leader)
    await addStop(t, t.member, { dayId: otherDays[0].id, placeId: t.amber.id, startTime: '09:00' }).expect(400)
  })

  it('only the leader can lock; members cannot edit or delete locked stops', async () => {
    const t = await setup()
    const stop = (await addStop(t, t.member, { placeId: t.amber.id, startTime: '09:00' }).expect(201)).body.item
    await addStop(t, t.member, { placeId: t.hawa.id, startTime: '11:00', isLocked: true }).expect(403)

    await request(app).patch(`${t.base}/itinerary/items/${stop.id}/lock`).set(auth(t.member.token)).send({ locked: true }).expect(403)
    await request(app).patch(`${t.base}/itinerary/items/${stop.id}/lock`).set(auth(t.leader.token)).send({ locked: true }).expect(200)

    const edit = await request(app).patch(`${t.base}/itinerary/items/${stop.id}`).set(auth(t.member.token)).send({ notes: 'x' }).expect(403)
    expect(edit.body.message).toBe(LOCKED)
    await request(app).delete(`${t.base}/itinerary/items/${stop.id}`).set(auth(t.member.token)).expect(403)
    await request(app).patch(`${t.base}/itinerary/items/${stop.id}`).set(auth(t.leader.token)).send({ notes: 'Leader can' }).expect(200)
  })

  it('stops of a place the leader locked are protected too', async () => {
    const t = await setup()
    const stop = (await addStop(t, t.member, { placeId: t.amber.id, startTime: '09:00' }).expect(201)).body.item
    await request(app).patch(`${t.base}/places/${t.amber.id}/lock`).set(auth(t.leader.token)).send({ locked: true }).expect(200)
    await request(app).delete(`${t.base}/itinerary/items/${stop.id}`).set(auth(t.member.token)).expect(403)
  })

  it('rejects a stale edit with 409 and returns the current stop (optimistic versioning)', async () => {
    const t = await setup()
    const stop = (await addStop(t, t.member, { placeId: t.amber.id, startTime: '09:00' }).expect(201)).body.item
    await request(app).patch(`${t.base}/itinerary/items/${stop.id}`).set(auth(t.leader.token)).send({ notes: 'Leader first', version: 1 }).expect(200)
    const stale = await request(app).patch(`${t.base}/itinerary/items/${stop.id}`).set(auth(t.member.token)).send({ notes: 'Member second', version: 1 }).expect(409)
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT', details: { current: { notes: 'Leader first', version: 2 } } })
  })

  it('moves a stop to another day and reorders a day (members keep locked times)', async () => {
    const t = await setup()
    const a = (await addStop(t, t.member, { placeId: t.amber.id, startTime: '09:00' })).body.item
    const b = (await addStop(t, t.member, { placeId: t.hawa.id, startTime: '11:00' })).body.item
    const c = (await addStop(t, t.member, { placeId: t.jal.id, startTime: '13:00' })).body.item

    await request(app).patch(`${t.base}/itinerary/items/${c.id}`).set(auth(t.member.token)).send({ dayId: t.days[1].id }).expect(200)
    const order = `${t.base}/itinerary/days/${t.days[0].id}/order`
    const res = await request(app)
      .put(order)
      .set(auth(t.member.token))
      .send({ items: [{ id: b.id, startTime: '09:00' }, { id: a.id, startTime: '10:30' }] })
      .expect(200)
    expect(res.body.items.map((i) => [i.id, i.position, i.startTime])).toEqual([
      [b.id, 0, '09:00'],
      [a.id, 1, '10:30'],
    ])
    // Must list exactly the day's stops
    await request(app).put(order).set(auth(t.member.token)).send({ items: [{ id: a.id, startTime: '09:00' }] }).expect(400)
    // A member can reorder around a locked stop but not change its time
    await request(app).patch(`${t.base}/itinerary/items/${a.id}/lock`).set(auth(t.leader.token)).send({ locked: true }).expect(200)
    await request(app).put(order).set(auth(t.member.token)).send({ items: [{ id: a.id, startTime: '08:00' }, { id: b.id, startTime: '09:30' }] }).expect(403)
    await request(app).put(order).set(auth(t.member.token)).send({ items: [{ id: a.id, startTime: '10:30' }, { id: b.id, startTime: '12:00' }] }).expect(200)
  })

  it('auto-plan saves a batch; regenerate keeps locked stops', async () => {
    const t = await setup()
    const locked = (await addStop(t, t.leader, { placeId: t.amber.id, startTime: '09:00' })).body.item
    await request(app).patch(`${t.base}/itinerary/items/${locked.id}/lock`).set(auth(t.leader.token)).send({ locked: true }).expect(200)
    await addStop(t, t.member, { placeId: t.hawa.id, startTime: '12:00' }).expect(201)

    const plan = await request(app)
      .post(`${t.base}/itinerary/plan`)
      .set(auth(t.member.token))
      .send({ replaceDayId: t.days[0].id, items: [{ dayId: t.days[0].id, placeId: t.jal.id, startTime: '13:00', durationMinutes: 45 }] })
      .expect(201)
    expect(plan.body.added).toBe(1)
    const [day1] = await itinerary(t, t.leader)
    expect(day1.items.map((i) => [i.placeId, i.source])).toEqual([
      [t.amber.id, 'MANUAL'], // locked → kept
      [t.jal.id, 'AI'], // unlocked Hawa Mahal was replaced
    ])
  })

  it('logs stop changes with the member’s name and hides the itinerary from strangers', async () => {
    const t = await setup()
    const stop = (await addStop(t, t.member, { placeId: t.amber.id, startTime: '09:00' })).body.item
    await request(app).delete(`${t.base}/itinerary/items/${stop.id}`).set(auth(t.member.token)).expect(204)
    const feed = (await request(app).get(`${t.base}/activities`).set(auth(t.leader.token))).body.activities
    expect(feed.slice(0, 2).map((a) => a.message)).toEqual([`${t.member.user.name} removed Amber Fort from Day 1`, `${t.member.user.name} added Amber Fort to Day 1`])

    const stranger = await signUp()
    await request(app).get(`${t.base}/itinerary`).set(auth(stranger.token)).expect(403)
  })
})
