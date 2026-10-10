import { env } from '../../config/env.js'
import * as authService from './auth.service.js'

export const REFRESH_COOKIE = 'tripzy_rt'

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  // Only sent to the auth endpoints that need it.
  path: '/api/auth',
})

function meta(req) {
  return { userAgent: req.get('user-agent') }
}

/** Puts the refresh token in an httpOnly cookie and returns the rest as JSON. */
function sendSession(res, status, { refreshToken, ...session }) {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions(), maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 })
  res.set('Cache-Control', 'no-store')
  res.status(status).json(session)
}

export async function register(req, res) {
  const session = await authService.register(req.body, meta(req))
  req.log.info({ userId: session.user.id }, 'user registered')
  sendSession(res, 201, session)
}

export async function login(req, res) {
  const session = await authService.login(req.body, meta(req))
  req.log.info({ userId: session.user.id }, 'user logged in')
  sendSession(res, 200, session)
}

export async function refresh(req, res) {
  try {
    const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE], meta(req))
    sendSession(res, 200, session)
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions())
    throw error
  }
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE])
  res.clearCookie(REFRESH_COOKIE, cookieOptions())
  res.status(204).end()
}

export function me(req, res) {
  res.set('Cache-Control', 'no-store')
  res.json({ user: req.user })
}
