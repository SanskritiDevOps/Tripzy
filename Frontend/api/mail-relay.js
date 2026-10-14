// Vercel Function: POST /api/mail-relay — see api/_lib/relay.js.
// Settings (Vercel → Project → Settings → Environment Variables, NOT prefixed with VITE_,
// so they never reach the browser): SMTP_URL, MAIL_FROM, MAIL_RELAY_SECRET.

import nodemailer from 'nodemailer'
import { createRelayHandler } from './_lib/relay.js'

export default createRelayHandler({ createTransport: (...args) => nodemailer.createTransport(...args) })
