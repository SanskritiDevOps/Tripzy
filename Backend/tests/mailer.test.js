import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app, auth, tripWithTeam } from './helpers.js'
import { env } from '../src/config/env.js'
import { parseAddress, sendMail } from '../src/config/mailer.js'

function stubBrevo(status = 201, body = { messageId: '<1@brevo>' }) {
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
  env.BREVO_API_KEY = undefined
  env.MAIL_FROM = 'Tripzy <no-reply@tripzy.app>'
})

describe('mailer', () => {
  it('parses "Name <email>" sender addresses', () => {
    expect(parseAddress('Tripzy <trips@gmail.com>')).toEqual({ name: 'Tripzy', email: 'trips@gmail.com' })
    expect(parseAddress('"Trip Bot" <bot@x.io>')).toEqual({ name: 'Trip Bot', email: 'bot@x.io' })
    expect(parseAddress('plain@x.io')).toEqual({ email: 'plain@x.io' })
  })

  it('without any mail settings, logs the message instead of sending', async () => {
    const calls = stubBrevo()
    expect(await sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Hello' })).toEqual({ delivered: false })
    expect(calls).toHaveLength(0)
  })

  it('sends through Brevo’s HTTPS API when BREVO_API_KEY is set', async () => {
    env.BREVO_API_KEY = 'test-brevo-key'
    env.MAIL_FROM = 'Tripzy <trips@gmail.com>'
    const calls = stubBrevo()
    const result = await sendMail({ to: 'friend@example.com', subject: 'Join my trip', text: 'Link: …', html: '<p>Link</p>' })
    expect(result).toEqual({ delivered: true })
    expect(calls[0].url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(calls[0].headers['api-key']).toBe('test-brevo-key')
    expect(calls[0].body).toEqual({
      sender: { name: 'Tripzy', email: 'trips@gmail.com' },
      to: [{ email: 'friend@example.com' }],
      subject: 'Join my trip',
      textContent: 'Link: …',
      htmlContent: '<p>Link</p>',
    })
  })

  it('never throws when Brevo rejects the request (e.g. a wrong key)', async () => {
    env.BREVO_API_KEY = 'bad-key'
    stubBrevo(401, { code: 'unauthorized', message: 'Key not found' })
    expect(await sendMail({ to: 'friend@example.com', subject: 'x', text: 'y' })).toEqual({ delivered: false })
  })

  it('invites report emailDelivered: true when Brevo accepts the email', async () => {
    env.BREVO_API_KEY = 'test-brevo-key'
    const calls = stubBrevo()
    const { leader, trip } = await tripWithTeam()
    const res = await request(app).post(`/api/trips/${trip.id}/invites`).set(auth(leader.token)).send({ email: 'newfriend@example.com' }).expect(201)
    expect(res.body.emailDelivered).toBe(true)
    expect(calls[0].body.to).toEqual([{ email: 'newfriend@example.com' }])
    expect(calls[0].body.textContent).toContain('/join-trip?token=')
  })
})

describe('mailer via the Vercel mail relay', () => {
  afterEach(() => {
    env.MAIL_RELAY_URL = undefined
    env.MAIL_RELAY_SECRET = undefined
  })

  it('posts the email to the relay with the shared secret', async () => {
    env.MAIL_RELAY_URL = 'https://tripzy.example/api/mail-relay'
    env.MAIL_RELAY_SECRET = 'r'.repeat(48)
    const calls = stubBrevo(200, { delivered: true })
    expect(await sendMail({ to: 'friend@example.com', subject: 'Join', text: 'Link', html: '<p>Link</p>' })).toEqual({ delivered: true })
    expect(calls[0].url).toBe('https://tripzy.example/api/mail-relay')
    expect(calls[0].headers['X-Relay-Secret']).toBe('r'.repeat(48))
    expect(calls[0].body).toEqual({ to: 'friend@example.com', subject: 'Join', text: 'Link', html: '<p>Link</p>' })
  })

  it('reports not delivered (never throws) when the relay refuses', async () => {
    env.MAIL_RELAY_URL = 'https://tripzy.example/api/mail-relay'
    env.MAIL_RELAY_SECRET = 'wrong'
    stubBrevo(401, { message: 'Unauthorized' })
    expect(await sendMail({ to: 'friend@example.com', subject: 'x', text: 'y' })).toEqual({ delivered: false })
  })

  it('Brevo wins when both are configured', async () => {
    env.BREVO_API_KEY = 'brevo-key'
    env.MAIL_RELAY_URL = 'https://tripzy.example/api/mail-relay'
    env.MAIL_RELAY_SECRET = 'r'.repeat(48)
    const calls = stubBrevo()
    await sendMail({ to: 'friend@example.com', subject: 'x', text: 'y' })
    expect(calls[0].url).toBe('https://api.brevo.com/v3/smtp/email')
  })
})
