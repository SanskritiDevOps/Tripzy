import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { prisma } from '../src/config/prisma.js'

// Google's token verification is replaced by a fake: tests send a JSON
// profile as the "credential" instead of a real Google-signed ID token.
vi.mock('../src/modules/auth/google.js', async () => {
  const { AppError } = await import('../src/utils/AppError.js')
  return {
    isGoogleEnabled: () => true,
    verifyGoogleIdToken: async (credential) => {
      const profile = JSON.parse(credential.replace(/^fake-google-token:/, ''))
      if (profile.invalid) throw AppError.unauthorized('Google sign-in failed. Please try again.', { code: 'GOOGLE_TOKEN_INVALID' })
      if (!profile.verified) throw AppError.unauthorized('Your Google email address isn’t verified.', { code: 'GOOGLE_EMAIL_UNVERIFIED' })
      return { googleId: profile.sub, email: profile.email, name: profile.name, avatarUrl: profile.picture ?? null }
    },
  }
})

const { app, signUp } = await import('./helpers.js')

const credential = (profile) => `fake-google-token:${JSON.stringify({ verified: true, name: 'Priya Nair', ...profile })}`
const googleLogin = (profile) => request(app).post('/api/auth/google').send({ credential: credential(profile) })

describe('POST /api/auth/google', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new password-less account on first sign-in', async () => {
    const res = await googleLogin({ sub: 'g-111', email: 'priya@gmail.com', picture: 'https://lh3.googleusercontent.com/a/p' }).expect(201)

    expect(res.body.accessToken).toEqual(expect.any(String))
    expect(res.body.user).toMatchObject({ name: 'Priya Nair', email: 'priya@gmail.com', avatarUrl: 'https://lh3.googleusercontent.com/a/p' })
    expect(res.headers['set-cookie'].some((c) => c.startsWith('tripzy_rt=') && c.includes('HttpOnly'))).toBe(true)

    const user = await prisma.user.findUnique({ where: { email: 'priya@gmail.com' } })
    expect(user).toMatchObject({ googleId: 'g-111', passwordHash: null })
  })

  it('signs the same Google account back in (200, same user)', async () => {
    const first = await googleLogin({ sub: 'g-222', email: 'aman@gmail.com' }).expect(201)
    const second = await googleLogin({ sub: 'g-222', email: 'aman@gmail.com' }).expect(200)
    expect(second.body.user.id).toBe(first.body.user.id)
    expect(await prisma.user.count()).toBe(1)
  })

  it('links Google to an existing email/password account with the same verified email', async () => {
    const { user } = await signUp({ email: 'rahul@gmail.com' })
    const res = await googleLogin({ sub: 'g-333', email: 'rahul@gmail.com' }).expect(200)

    expect(res.body.user.id).toBe(user.id)
    const stored = await prisma.user.findUnique({ where: { id: user.id } })
    expect(stored.googleId).toBe('g-333')
    expect(stored.passwordHash).not.toBeNull() // password login keeps working
    await request(app).post('/api/auth/login').send({ email: 'rahul@gmail.com', password: 'secret123' }).expect(200)
  })

  it('refuses to link an email that already belongs to a different Google account', async () => {
    await googleLogin({ sub: 'g-444', email: 'riya@gmail.com' }).expect(201)
    const res = await googleLogin({ sub: 'g-999', email: 'riya@gmail.com' }).expect(409)
    expect(res.body.code).toBe('GOOGLE_ACCOUNT_MISMATCH')
  })

  it('rejects unverified Google emails and invalid tokens', async () => {
    const unverified = await googleLogin({ sub: 'g-555', email: 'x@gmail.com', verified: false }).expect(401)
    expect(unverified.body.code).toBe('GOOGLE_EMAIL_UNVERIFIED')
    const invalid = await googleLogin({ invalid: true }).expect(401)
    expect(invalid.body.code).toBe('GOOGLE_TOKEN_INVALID')
    expect(await prisma.user.count()).toBe(0)
  })

  it('validates the request body', async () => {
    await request(app).post('/api/auth/google').send({}).expect(400)
  })

  it('a Google-only account cannot log in with a password', async () => {
    await googleLogin({ sub: 'g-666', email: 'google.only@gmail.com' }).expect(201)
    const res = await request(app).post('/api/auth/login').send({ email: 'google.only@gmail.com', password: 'anything1' }).expect(401)
    expect(res.body.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('GET /api/auth/providers', () => {
  it('advertises Google when it is enabled', async () => {
    const res = await request(app).get('/api/auth/providers').expect(200)
    expect(res.body).toMatchObject({ password: true, google: expect.any(Object) })
  })
})
