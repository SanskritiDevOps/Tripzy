import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

const tokenFrom = (inviteUrl) => new URL(inviteUrl).searchParams.get('token')

async function invite(trip, leader, email) {
  const res = await request(app).post(`/api/trips/${trip.id}/invites`).set(auth(leader.token)).send({ email }).expect(201)
  return { ...res.body, token: tokenFrom(res.body.inviteUrl) }
}

describe('POST /api/trips/:tripId/invites', () => {
  it('lets the leader invite by email and returns a /join-trip link', async () => {
    const { leader, trip } = await tripWithTeam()
    const res = await invite(trip, leader, 'New.Friend@Example.com')

    expect(res.invite).toMatchObject({ email: 'new.friend@example.com', status: 'PENDING', expired: false })
    expect(res.inviteUrl).toMatch(/\/join-trip\?token=[\w-]{40,}$/)
    expect(res.emailDelivered).toBe(false) // no SMTP in tests → logged instead

    // Only a hash of the token is stored.
    const stored = await prisma.tripInvite.findFirst()
    expect(stored.tokenHash).not.toContain(res.token)
  })

  it('is leader-only', async () => {
    const { member, trip } = await tripWithTeam()
    const res = await request(app).post(`/api/trips/${trip.id}/invites`).set(auth(member.token)).send({ email: 'x@example.com' }).expect(403)
    expect(res.body.message).toBe('Only the team leader can manage invitations.')
    await request(app).get(`/api/trips/${trip.id}/invites`).set(auth(member.token)).expect(403)
  })

  it('refuses to invite someone who is already a member', async () => {
    const { leader, member, trip } = await tripWithTeam()
    const res = await request(app).post(`/api/trips/${trip.id}/invites`).set(auth(leader.token)).send({ email: member.user.email }).expect(409)
    expect(res.body.code).toBe('ALREADY_MEMBER')
  })

  it('re-inviting the same email replaces the old invite', async () => {
    const { leader, trip } = await tripWithTeam()
    const first = await invite(trip, leader, 'dup@example.com')
    await invite(trip, leader, 'dup@example.com')
    const list = await request(app).get(`/api/trips/${trip.id}/invites`).set(auth(leader.token)).expect(200)
    expect(list.body.invites).toHaveLength(1)

    const guest = await signUp({ email: 'dup@example.com' })
    const res = await request(app).post('/api/trips/join').set(auth(guest.token)).send({ token: first.token }).expect(410)
    expect(res.body.code).toBe('INVITE_REVOKED')
  })
})

describe('joining a trip', () => {
  it('previews the invite publicly without exposing the full email', async () => {
    const { leader, trip } = await tripWithTeam()
    const { token } = await invite(trip, leader, 'priya.nair@example.com')
    const res = await request(app).get(`/api/invites/${token}`).expect(200)
    expect(res.body.invite).toMatchObject({ status: 'PENDING', email: 'pr********@example.com', trip: { name: trip.name, memberCount: 2 } })
    await request(app).get('/api/invites/not-a-real-token-at-all-xyz').expect(404)
  })

  it('the invited user joins as MEMBER and the invite is marked accepted', async () => {
    const { leader, trip } = await tripWithTeam()
    const { token } = await invite(trip, leader, 'guest@example.com')
    const guest = await signUp({ email: 'guest@example.com' })

    const res = await request(app).post('/api/trips/join').set(auth(guest.token)).send({ token }).expect(200)
    expect(res.body.trip).toMatchObject({ id: trip.id, role: 'MEMBER' })

    const membership = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId: trip.id, userId: guest.user.id } } })
    expect(membership.role).toBe('MEMBER')
    expect((await prisma.tripInvite.findFirst()).status).toBe('ACCEPTED')

    // Clicking the link again is harmless.
    await request(app).post('/api/trips/join').set(auth(guest.token)).send({ token }).expect(200)
  })

  it('requires login', async () => {
    const { leader, trip } = await tripWithTeam()
    const { token } = await invite(trip, leader, 'guest@example.com')
    await request(app).post('/api/trips/join').send({ token }).expect(401)
  })

  it('rejects a user whose email does not match the invite', async () => {
    const { leader, trip } = await tripWithTeam()
    const { token } = await invite(trip, leader, 'intended@example.com')
    const other = await signUp({ email: 'someone.else@example.com' })
    const res = await request(app).post('/api/trips/join').set(auth(other.token)).send({ token }).expect(403)
    expect(res.body.code).toBe('INVITE_EMAIL_MISMATCH')
    expect(res.body.message).toContain('in******@example.com')
  })

  it('rejects revoked and expired invites', async () => {
    const { leader, trip } = await tripWithTeam()
    const revoked = await invite(trip, leader, 'a@example.com')
    await request(app).delete(`/api/trips/${trip.id}/invites/${revoked.invite.id}`).set(auth(leader.token)).expect(204)
    const a = await signUp({ email: 'a@example.com' })
    expect((await request(app).post('/api/trips/join').set(auth(a.token)).send({ token: revoked.token }).expect(410)).body.code).toBe('INVITE_REVOKED')

    const expired = await invite(trip, leader, 'b@example.com')
    await prisma.tripInvite.update({ where: { id: expired.invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const b = await signUp({ email: 'b@example.com' })
    expect((await request(app).post('/api/trips/join').set(auth(b.token)).send({ token: expired.token }).expect(410)).body.code).toBe('INVITE_EXPIRED')
  })

  it('an accepted invite cannot be reused by another account', async () => {
    const { leader, trip } = await tripWithTeam()
    const { token } = await invite(trip, leader, 'once@example.com')
    const first = await signUp({ email: 'once@example.com' })
    await request(app).post('/api/trips/join').set(auth(first.token)).send({ token }).expect(200)
    const second = await signUp()
    expect((await request(app).post('/api/trips/join').set(auth(second.token)).send({ token }).expect(410)).body.code).toBe('INVITE_USED')
  })
})
