// Mail relay core: lets the Tripzy API (on Render, where SMTP ports are blocked)
// send email through Gmail from a Vercel Function, where ports 465/587 are open.
// Only requests carrying MAIL_RELAY_SECRET are accepted, one recipient at a time.
// Files under api/_lib are not exposed as routes by Vercel.

import crypto from 'node:crypto'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sameSecret(given, expected) {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function validMessage({ to, subject, text, html } = {}) {
  return (
    typeof to === 'string' && to.length <= 254 && EMAIL.test(to) &&
    typeof subject === 'string' && subject.length > 0 && subject.length <= 200 &&
    typeof text === 'string' && text.length <= 20_000 &&
    (html === undefined || (typeof html === 'string' && html.length <= 100_000))
  )
}

/** `createTransport` is Nodemailer's (injected so the handler can be tested without sending). */
export function createRelayHandler({ createTransport, env = process.env, log = console }) {
  let transport = null

  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ message: 'Method not allowed' })
    }
    if (!env.MAIL_RELAY_SECRET || !env.SMTP_URL) return res.status(503).json({ message: 'Mail relay is not configured' })

    const given = req.headers['x-relay-secret']
    if (typeof given !== 'string' || !sameSecret(given, env.MAIL_RELAY_SECRET)) return res.status(401).json({ message: 'Unauthorized' })

    const message = req.body ?? {}
    if (!validMessage(message)) return res.status(400).json({ message: 'Invalid email' })

    try {
      // Fail fast instead of Nodemailer's 2-minute default (Vercel functions have a time limit).
      transport ??= createTransport(env.SMTP_URL, { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 })
      // Awaited: Vercel pauses the function as soon as it responds.
      await transport.sendMail({ from: env.MAIL_FROM || undefined, to: message.to, subject: message.subject, text: message.text, html: message.html })
      return res.status(200).json({ delivered: true })
    } catch (error) {
      log.error('mail relay: send failed —', error.message)
      return res.status(502).json({ message: 'Could not send the email' })
    }
  }
}
