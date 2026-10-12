import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, uniqueUser } from './helpers.js'
import { prisma } from '../src/config/prisma.js'

const refreshCookie = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('tripzy_rt='))

describe('POST /api/auth/register', () => {
  it('creates a user, returns a token and never the password hash', async () => {
    const body = uniqueUser({ email: 'Mixed.Case@Example.com' })
    const res = await request(app).post('/api/auth/register').send(body).expect(201)

    expect(res.body.accessToken).toEqual(expect.any(String))
    expect(res.body.user).toMatchObject({ name: body.name, email: 'mixed.case@example.com' })
    expect(JSON.stringify(res.body)).not.toMatch(/password/i)

    const cookie = refreshCookie(res)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Path=\/api\/auth/)

    const stored = await prisma.user.findUnique({ where: { email: 'mixed.case@example.com' } })
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/)
  })

  it('rejects a duplicate email (case-insensitive) with 409', async () => {
    await signUp({ email: 'dup@example.com' })
    const res = await request(app).post('/api/auth/register').send(uniqueUser({ email: 'DUP@example.com' })).expect(409)
    expect(res.body).toMatchObject({ code: 'EMAIL_TAKEN', details: { email: 'Email already in use' } })
  })

  it('returns field errors for invalid input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'short' }).expect(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['name', 'email', 'password']))
  })
})

describe('POST /api/auth/login', () => {
  it('logs in with the right password', async () => {
    const { user } = await signUp({ email: 'login@example.com' })
    const res = await request(app).post('/api/auth/login').send({ email: 'LOGIN@example.com', password: 'secret123' }).expect(200)
    expect(res.body.user.id).toBe(user.id)
    expect(refreshCookie(res)).toBeDefined()
  })

  it('gives the same error for a wrong password and an unknown email', async () => {
    await signUp({ email: 'known@example.com' })
    const wrong = await request(app).post('/api/auth/login').send({ email: 'known@example.com', password: 'nope12345' }).expect(401)
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'nope12345' }).expect(401)
    expect(wrong.body).toEqual(unknown.body)
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const { user, token } = await signUp()
    const res = await request(app).get('/api/auth/me').set(auth(token)).expect(200)
    expect(res.body.user).toEqual(user)
  })

  it('returns 401 without a token or with a forged one', async () => {
    await request(app).get('/api/auth/me').expect(401)
    const res = await request(app).get('/api/auth/me').set(auth('not.a.jwt')).expect(401)
    expect(res.body.code).toBe('INVALID_TOKEN')
  })
})

describe('refresh token rotation', () => {
  it('issues a new token pair and rejects the old refresh token', async () => {
    const { cookie } = await signUp()
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200)
    expect(first.body.accessToken).toEqual(expect.any(String))

    // Make the rotation look old, so a replay is treated as theft: it fails…
    await prisma.refreshToken.updateMany({ where: { revokedReason: 'ROTATED' }, data: { revokedAt: new Date(Date.now() - 60_000) } })
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401)
    expect(replay.body.code).toBe('INVALID_REFRESH_TOKEN')
    // …and the whole family is revoked, so the newest token stops working too.
    await request(app).post('/api/auth/refresh').set('Cookie', first.headers['set-cookie']).expect(401)
  })

  it('a just-used token still works within the grace window (lost reply, or another tab won the race)', async () => {
    const { cookie } = await signUp()
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200)
    // The browser never got `first` (e.g. the page reloaded mid-request) and sends the old token again.
    const retry = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200)
    expect(retry.body.accessToken).toEqual(expect.any(String))
    // Both new tokens are valid; nobody is logged out.
    await request(app).post('/api/auth/refresh').set('Cookie', retry.headers['set-cookie']).expect(200)
    await request(app).post('/api/auth/refresh').set('Cookie', first.headers['set-cookie']).expect(200)
  })

  it('the grace window never revives a logged-out session', async () => {
    const { cookie } = await signUp()
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200)
    await request(app).post('/api/auth/logout').set('Cookie', first.headers['set-cookie']).expect(204)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401) // old token, still inside the window
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('the grace window never revives a session flagged for token reuse', async () => {
    const { cookie } = await signUp()
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200)
    const second = await request(app).post('/api/auth/refresh').set('Cookie', first.headers['set-cookie']).expect(200)
    // `first` replayed long after it was rotated → theft → the whole family is revoked…
    await prisma.refreshToken.updateMany({ where: { revokedReason: 'ROTATED' }, data: { revokedAt: new Date(Date.now() - 60_000) } })
    await request(app).post('/api/auth/refresh').set('Cookie', first.headers['set-cookie']).expect(401)
    // …so even tokens still inside a grace window, and the newest one, are dead.
    await request(app).post('/api/auth/refresh').set('Cookie', second.headers['set-cookie']).expect(401)
    await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401)
  })

  it('logout revokes the session', async () => {
    const { cookie } = await signUp()
    await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(204)
    await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401)
  })

  it('refresh without a cookie is a 401', async () => {
    await request(app).post('/api/auth/refresh').expect(401)
  })
})
