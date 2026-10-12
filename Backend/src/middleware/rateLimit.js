import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
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

/**
 * Token refreshes (every page load, and every 15 min while the app is open).
 * Limited per IP, but generously: on college or office Wi-Fi hundreds of people
 * share one IP and must not log each other out. Each refresh token works only
 * once (it's rotated), so this only needs to stop one machine hammering the endpoint.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 5000 : 1500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Too many requests from your network. Please wait a few minutes.'),
})

/**
 * AI planning calls a paid/free-tier-limited external API, so it's limited per
 * account (not per IP): a short burst limit and a daily cap.
 */
const perUser = (req) => req.user?.id ?? ipKeyGenerator(req.ip)
// The code-only planner runs locally, so it isn't limited.
const codeOnly = (req) => req.body?.engine === 'code'
export const aiBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 1000 : 4,
  keyGenerator: perUser,
  skip: codeOnly,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('You’re planning very quickly — wait a minute and try again.'),
})
export const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: env.isTest ? 1000 : 40,
  keyGenerator: perUser,
  skip: codeOnly,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('You’ve reached today’s AI planning limit. Manual planning still works.'),
})
