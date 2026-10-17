import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app, auth, tripWithTeam } from './helpers.js'
import { env } from '../src/config/env.js'
import { sendMail } from '../src/config/mailer.js'

const RELAY_URL = 'https://tripzy.example/api/mail-relay'
const SECRET = 'r'.repeat(48)

function stubRelay(status = 200, body = { delivered: true }) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) })
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  env.MAIL_RELAY_URL = undefined
  env.MAIL_RELAY_SECRET = undefined
})

describe('mailer without mail settings', () => {
  it('logs the message instead of sending', async () => {
    const calls = stubRelay()
    expect(await sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Hello' })).toEqual({ delivered: false })
    expect(calls).toHaveLength(0)
  })
})

describe('mailer via the Vercel mail relay', () => {
  beforeEach(() => {
    env.MAIL_RELAY_URL = RELAY_URL
    env.MAIL_RELAY_SECRET = SECRET
  })

  it('posts the email to the relay with the shared secret', async () => {
    const calls = stubRelay()
    expect(await sendMail({ to: 'friend@example.com', subject: 'Join', text: 'Link', html: '<p>Link</p>' })).toEqual({ delivered: true })
    expect(calls[0].url).toBe(RELAY_URL)
    expect(calls[0].headers['X-Relay-Secret']).toBe(SECRET)
    expect(calls[0].body).toEqual({ to: 'friend@example.com', subject: 'Join', text: 'Link', html: '<p>Link</p>' })
  })

  it('reports not delivered (never throws) when the relay refuses', async () => {
    stubRelay(401, { message: 'Unauthorized' })
    expect(await sendMail({ to: 'friend@example.com', subject: 'x', text: 'y' })).toEqual({ delivered: false })
  })

  it('invites report emailDelivered: true and email the join link', async () => {
    const calls = stubRelay()
    const { leader, trip } = await tripWithTeam()
    const res = await request(app).post(`/api/trips/${trip.id}/invites`).set(auth(leader.token)).send({ email: 'newfriend@example.com' }).expect(201)
    expect(res.body.emailDelivered).toBe(true)
    expect(calls[0].body.to).toBe('newfriend@example.com')
    expect(calls[0].body.text).toContain('/join-trip?token=')
  })
})
