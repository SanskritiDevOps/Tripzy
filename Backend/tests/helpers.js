import request from 'supertest'
import { createApp } from '../src/app.js'

export const app = createApp()

let counter = 0
export function uniqueUser(overrides = {}) {
  counter += 1
  return { name: 'Test Traveller', email: `traveller${counter}@example.com`, password: 'secret123', ...overrides }
}

/** Registers a user and returns { user, token, cookie }. */
export async function signUp(overrides) {
  const res = await request(app).post('/api/auth/register').send(uniqueUser(overrides)).expect(201)
  return { user: res.body.user, token: res.body.accessToken, cookie: res.headers['set-cookie'] }
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` })

export const tripBody = {
  name: 'Jaipur Royal Weekend',
  destination: 'Jaipur, Rajasthan',
  startDate: '2026-11-14',
  endDate: '2026-11-17',
  budgetMinor: 12000000,
}

/** A trip with a team leader and one member: { leader, member, trip }. */
export async function tripWithTeam() {
  const { prisma } = await import('../src/config/prisma.js')
  const leader = await signUp()
  const member = await signUp()
  const res = await request(app).post('/api/trips').set(auth(leader.token)).send(tripBody).expect(201)
  await prisma.tripMember.create({ data: { tripId: res.body.trip.id, userId: member.user.id, role: 'MEMBER' } })
  return { leader, member, trip: res.body.trip }
}
