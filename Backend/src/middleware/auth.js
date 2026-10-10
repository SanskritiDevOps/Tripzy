import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'
import { verifyAccessToken } from '../modules/auth/tokens.js'
import { publicUser } from '../modules/auth/auth.service.js'

function bearerToken(req) {
  const header = req.get('authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null
}

/**
 * Verifies `Authorization: Bearer <access token>` and attaches the current
 * user to `req.user`. Responds 401 when the token is missing, invalid,
 * expired, or belongs to a deleted account.
 */
export function requireAuth({ message = 'Authentication required' } = {}) {
  return async (req, _res, next) => {
    const token = bearerToken(req)
    if (!token) return next(AppError.unauthorized(message, { code: 'AUTH_REQUIRED' }))

    let payload
    try {
      payload = verifyAccessToken(token)
    } catch (error) {
      const expired = error.name === 'TokenExpiredError'
      return next(
        AppError.unauthorized(expired ? 'Your session has expired. Please log in again.' : message, {
          code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        }),
      )
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) return next(AppError.unauthorized(message, { code: 'INVALID_TOKEN' }))

    req.user = publicUser(user)
    next()
  }
}
