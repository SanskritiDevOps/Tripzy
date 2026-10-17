import nodemailer from 'nodemailer'
import { env } from './env.js'
import { logger } from './logger.js'

// How mail goes out, first match wins:
//   MAIL_RELAY_URL     → the Vercel mail relay (Frontend/api/mail-relay.js) over HTTPS.
//   + MAIL_RELAY_SECRET  Free API hosts block SMTP ports; Vercel Functions don't.
//   SMTP_URL           → any SMTP server (e.g. Gmail with an app password), for local
//                        development and hosts that allow SMTP.
//   neither            → written to the log, so invite links are still usable.
// Sending never throws: a mail outage can't break the API call (invites fall back
// to the copy-link in the UI).

const SEND_TIMEOUT_MS = 10_000

const useRelay = () => Boolean(env.MAIL_RELAY_URL && env.MAIL_RELAY_SECRET)

const smtp = env.SMTP_URL
  ? nodemailer.createTransport(env.SMTP_URL, {
      // Fail fast if the host blocks SMTP, instead of nodemailer's 2-minute default.
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: 15_000,
    })
  : null

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
  if (!useRelay() && !smtp) {
    logger.info({ to, subject }, `[mail:dev] ${subject}\n${text}`)
    return { delivered: false }
  }
  try {
    if (useRelay()) await sendWithRelay({ to, subject, text, html })
    else await smtp.sendMail({ from: env.MAIL_FROM, to, subject, text, html })
    return { delivered: true }
  } catch (err) {
    logger.error({ err: err.message, to, subject }, 'Failed to send email')
    return { delivered: false }
  }
}
