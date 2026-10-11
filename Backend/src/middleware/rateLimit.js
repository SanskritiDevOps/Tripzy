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

/** Looser limit for token refreshes, which happen on every page load. */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Too many requests. Please slow down.'),
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
