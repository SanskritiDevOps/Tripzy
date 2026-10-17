import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'

/**
 * Trip-level access control.
 *
 *   requireTripAccess()                  → any member of the trip
 *   requireTripAccess(['LEADER'], msg)   → team leader only
 *
 * Must run after requireAuth. Reads the trip id from `:tripId`, then attaches
 * `req.membership` and `req.tripRole`. Non-members and members without an
 * allowed role get 403.
 */
export function requireTripAccess(allowedRoles = ['LEADER', 'MEMBER'], message) {
  return async (req, _res, next) => {
    const tripId = req.valid?.params?.tripId ?? req.params.tripId
    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: req.user.id } },
    })
    if (!membership) {
      return next(AppError.forbidden('You’re not a member of this trip.', { code: 'NOT_A_MEMBER' }))
    }
    if (!allowedRoles.includes(membership.role)) {
      return next(AppError.forbidden(message ?? 'Only the team leader can do that.', { code: 'LEADER_ONLY' }))
    }
    req.membership = membership
    req.tripRole = membership.role
    next()
  }
}

export const leaderOnly = (message) => requireTripAccess(['LEADER'], message)
