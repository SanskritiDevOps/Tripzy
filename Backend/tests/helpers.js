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
