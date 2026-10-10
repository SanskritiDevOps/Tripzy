import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env.js'

const message = (text) => ({ message: text, code: 'RATE_LIMITED' })

/** Per-IP limit on credential endpoints to slow down password guessing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Successful logins don't count against the limit.
  skipSuccessfulRequests: true,
  message: message('Too many attempts. Please wait a few minutes and try again.'),
})

/** Looser limit for token refreshes, which happen on every page load. */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Too many requests. Please slow down.'),
})
