import { describe, expect, it, vi } from 'vitest'
import { createRelayHandler } from '../api/_lib/relay.js'

const SECRET = 's'.repeat(48)
const env = { MAIL_RELAY_SECRET: SECRET, SMTP_URL: 'smtps://user:pass@smtp.example.com:465', MAIL_FROM: 'Tripzy <trips@example.com>' }
const email = { to: 'friend@example.com', subject: 'Join my trip', text: 'Link: https://tripzy.example/join-trip?token=abc' }

function setup({ sendMail = vi.fn(async () => ({})), relayEnv = env } = {}) {
  const createTransport = vi.fn(() => ({ sendMail }))
  const handler = createRelayHandler({ createTransport, env: relayEnv, log: { error: vi.fn() } })
  const call = async ({ method = 'POST', secret = SECRET, body = email } = {}) => {
    const res = { statusCode: 0, body: null, headers: {} }
    res.status = (code) => ((res.statusCode = code), res)
    res.json = (data) => ((res.body = data), res)
    res.setHeader = (name, value) => (res.headers[name] = value)
    await handler({ method, headers: secret ? { 'x-relay-secret': secret } : {}, body }, res)
    return res
  }
  return { call, sendMail, createTransport }
}

describe('mail relay (Vercel Function)', () => {
  it('sends one email from MAIL_FROM when the secret matches', async () => {
    const { call, sendMail } = setup()
    const res = await call()
    expect(res.statusCode).toBe(200)
    expect(sendMail).toHaveBeenCalledWith({ ...email, from: env.MAIL_FROM, html: undefined })
  })

  it('rejects a missing or wrong secret without sending', async () => {
    const { call, sendMail } = setup()
    expect((await call({ secret: null })).statusCode).toBe(401)
    expect((await call({ secret: 'x'.repeat(48) })).statusCode).toBe(401)
    expect((await call({ secret: 'short' })).statusCode).toBe(401)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('accepts only POST', async () => {
    const res = await setup().call({ method: 'GET' })
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST')
  })

  it('refuses malformed emails, e.g. several recipients', async () => {
    const { call, sendMail } = setup()
    expect((await call({ body: { ...email, to: 'a@example.com, b@example.com' } })).statusCode).toBe(400)
    expect((await call({ body: { ...email, subject: '' } })).statusCode).toBe(400)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('reports 503 when it is not configured', async () => {
    expect((await setup({ relayEnv: { MAIL_RELAY_SECRET: SECRET } }).call()).statusCode).toBe(503)
  })

  it('reports 502 when Gmail refuses, and reuses one SMTP connection', async () => {
    const sendMail = vi.fn().mockRejectedValueOnce(new Error('535 Bad credentials')).mockResolvedValueOnce({})
    const { call, createTransport } = setup({ sendMail })
    expect((await call()).statusCode).toBe(502)
    expect((await call()).statusCode).toBe(200)
    expect(createTransport).toHaveBeenCalledTimes(1)
  })
})
