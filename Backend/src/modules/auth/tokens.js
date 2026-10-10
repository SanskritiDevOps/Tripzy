import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'

const ISSUER = 'tripzy-api'
const AUDIENCE = 'tripzy-web'

/** Short-lived JWT sent as `Authorization: Bearer <token>`. */
export function signAccessToken(user) {
  return jwt.sign({ email: user.email }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  })
}

/** Throws jsonwebtoken errors (TokenExpiredError, JsonWebTokenError) on failure. */
export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  })
  if (typeof payload.sub !== 'string') throw new jwt.JsonWebTokenError('Token has no subject')
  return payload
}

/** Seconds until an access token issued now expires (for the client's info). */
export function accessTokenLifetimeSeconds() {
  const decoded = jwt.decode(jwt.sign({}, 'x', { expiresIn: env.ACCESS_TOKEN_TTL }))
  return decoded.exp - decoded.iat
}

/** Opaque 384-bit refresh token. Only its SHA-256 hash is stored. */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url')
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function refreshTokenExpiry(from = new Date()) {
  return new Date(from.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
}
