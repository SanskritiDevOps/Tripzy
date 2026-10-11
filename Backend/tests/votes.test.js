import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

const place = { name: 'Amber Fort', lat: 26.98, lng: 75.85, category: 'sight' }

async function setup() {
  const team = await tripWithTeam()
  const res = await request(app).post(`/api/trips/${team.trip.id}/places`).set(auth(team.leader.token)).send(place).expect(201)
  return { ...team, place: res.body.place }
}
const vote = (t, user, value) => request(app).put(`/api/trips/${t.trip.id}/places/${t.place.id}/vote`).set(auth(user.token)).send({ value })

describe('votes', () => {
  it('every member’s vote counts, one per person, and is visible to everyone', async () => {
    const t = await setup()
    await vote(t, t.leader, 1).expect(200)
    await vote(t, t.member, 1).expect(200)
    await vote(t, t.member, 1).expect(200) // same vote again: still one row

    const list = await request(app).get(`/api/trips/${t.trip.id}/places`).set(auth(t.leader.token)).expect(200)
    expect(list.body.places[0].votes).toEqual(
      expect.arrayContaining([
        { userId: t.leader.user.id, value: 1 },
        { userId: t.member.user.id, value: 1 },
      ]),
    )
    expect(await prisma.vote.count()).toBe(2)
  })

  it('changing a vote updates it in place; DELETE removes it', async () => {
    const t = await setup()
    await vote(t, t.member, 1).expect(200)
    const changed = await vote(t, t.member, -1).expect(200)
    expect(changed.body.place.votes).toEqual([{ userId: t.member.user.id, value: -1 }])
    const removed = await request(app).delete(`/api/trips/${t.trip.id}/places/${t.place.id}/vote`).set(auth(t.member.token)).expect(200)
    expect(removed.body.place.votes).toEqual([])
  })

  it('rejects invalid values and non-members', async () => {
    const t = await setup()
    await vote(t, t.member, 2).expect(400)
    const stranger = await signUp()
    await vote(t, stranger, 1).expect(403)
  })

  it('logs votes in the activity feed with the voter’s name', async () => {
    const t = await setup()
    await vote(t, t.member, -1).expect(200)
    const feed = await request(app).get(`/api/trips/${t.trip.id}/activities`).set(auth(t.leader.token))
    expect(feed.body.activities[0]).toMatchObject({ action: 'VOTED', user: { id: t.member.user.id }, message: `${t.member.user.name} downvoted Amber Fort` })
  })

  it('only the leader closes voting; closing locks the winners and blocks further votes', async () => {
    const t = await setup()
    const loser = (await request(app).post(`/api/trips/${t.trip.id}/places`).set(auth(t.member.token)).send({ ...place, name: 'Jal Mahal' })).body.place
    await vote(t, t.member, 1).expect(200)
    await request(app).put(`/api/trips/${t.trip.id}/places/${loser.id}/vote`).set(auth(t.member.token)).send({ value: -1 }).expect(200)

    await request(app).post(`/api/trips/${t.trip.id}/voting/close`).set(auth(t.member.token)).expect(403)
    const closed = await request(app).post(`/api/trips/${t.trip.id}/voting/close`).set(auth(t.leader.token)).expect(200)
    expect(closed.body.lockedCount).toBe(1)
    expect((await prisma.place.findUnique({ where: { id: t.place.id } })).isLocked).toBe(true)
    expect((await prisma.place.findUnique({ where: { id: loser.id } })).isLocked).toBe(false)

    const blocked = await vote(t, t.leader, 1).expect(409)
    expect(blocked.body.code).toBe('VOTING_CLOSED')

    await request(app).post(`/api/trips/${t.trip.id}/voting/reopen`).set(auth(t.leader.token)).expect(204)
    await vote(t, t.leader, 1).expect(200)
    // Reopening keeps the lock.
    expect((await prisma.place.findUnique({ where: { id: t.place.id } })).isLocked).toBe(true)
  })
})
