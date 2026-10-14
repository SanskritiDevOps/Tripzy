import nodemailer from 'nodemailer'
import { env } from './env.js'
import { logger } from './logger.js'

// How mail goes out, first match wins:
//   BREVO_API_KEY      → Brevo's HTTPS API. Works on free hosting (Render, Railway…),
//                        which block the SMTP ports 25/465/587.
//   MAIL_RELAY_URL     → the Vercel mail relay (Frontend/api/mail-relay.js) over HTTPS,
//   + MAIL_RELAY_SECRET  which sends through Gmail with Nodemailer on Vercel (SMTP allowed there).
//   SMTP_URL           → any SMTP server (e.g. Gmail with an app password). Fine locally
//                        and on hosts that allow SMTP.
//   neither       → written to the log (local dev), so invite links are still usable.
// Sending never throws: a mail outage can't break the API call (invites fall back
// to the copy-link in the UI).

const SEND_TIMEOUT_MS = 10_000

const useRelay = () => !env.BREVO_API_KEY && Boolean(env.MAIL_RELAY_URL && env.MAIL_RELAY_SECRET)

const smtp = !env.BREVO_API_KEY && !(env.MAIL_RELAY_URL && env.MAIL_RELAY_SECRET) && env.SMTP_URL
  ? nodemailer.createTransport(env.SMTP_URL, {
      // Fail fast if the host blocks SMTP, instead of nodemailer's 2-minute default.
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: 15_000,
    })
  : null

export const emailDeliveryEnabled = () => Boolean(env.BREVO_API_KEY || useRelay() || smtp)

/** "Tripzy <you@gmail.com>" → { name: 'Tripzy', email: 'you@gmail.com' } */
export function parseAddress(value) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value)
  return match ? { name: match[1].replace(/^"|"$/g, '') || undefined, email: match[2].trim() } : { email: value.trim() }
}

async function sendWithBrevo({ to, subject, text, html }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: parseAddress(env.MAIL_FROM), to: [{ email: to }], subject, textContent: text, htmlContent: html ?? `<pre>${text}</pre>` }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(`Brevo responded ${response.status}: ${body.message ?? body.code ?? 'unknown error'}`)
  }
}

async function sendWithRelay({ to, subject, text, html }) {
  const response = await fetch(env.MAIL_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': env.MAIL_RELAY_SECRET },
    body: JSON.stringify({ to, subject, text, html }),
    signal: AbortSignal.timeout(20_000), // the relay itself gives up on Gmail after ~15 s
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(`Mail relay responded ${response.status}: ${body.message ?? 'unknown error'}`)
  }
}

/** Sends an email. Returns { delivered } and never throws. */
export async function sendMail({ to, subject, text, html }) {
  if (!emailDeliveryEnabled()) {
    logger.info({ to, subject }, `[mail:dev] ${subject}\n${text}`)
    return { delivered: false }
  }
  try {
    if (env.BREVO_API_KEY) await sendWithBrevo({ to, subject, text, html })
    else if (useRelay()) await sendWithRelay({ to, subject, text, html })
    else await smtp.sendMail({ from: env.MAIL_FROM, to, subject, text, html })
    return { delivered: true }
  } catch (err) {
    logger.error({ err: err.message, to, subject }, 'Failed to send email')
    return { delivered: false }
  }
}
