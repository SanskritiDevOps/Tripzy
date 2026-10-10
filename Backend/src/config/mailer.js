import nodemailer from 'nodemailer'
import { env } from './env.js'
import { logger } from './logger.js'

// With SMTP_URL set, mail goes out through that server. Without it (local dev),
// messages are written to the log instead so invite links are still usable.
const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null

export const emailDeliveryEnabled = () => Boolean(transport)

/** Sends an email. Returns { delivered } and never throws, so a mail outage can't break the API call. */
export async function sendMail({ to, subject, text, html }) {
  if (!transport) {
    logger.info({ to, subject }, `[mail:dev] ${subject}\n${text}`)
    return { delivered: false }
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text, html })
    return { delivered: true }
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email')
    return { delivered: false }
  }
}
