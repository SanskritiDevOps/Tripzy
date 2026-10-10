import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'

/**
 * Requires the authenticated user to belong to the trip in `req.params.tripId`
 * (README §10.6). With `ownerOnly`, the user must also be the trip owner.
 * Attaches the membership to `req.membership`.
 *
 * Non-members get 404 rather than 403 so trip ids can't be probed.
 */
export function requireTripMember({ ownerOnly = false } = {}) {
  return async (req, _res, next) => {
    const tripId = req.valid?.params?.tripId ?? req.params.tripId
    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: req.user.id } },
    })
    if (!membership) return next(AppError.notFound('Trip not found', { code: 'TRIP_NOT_FOUND' }))
    if (ownerOnly && membership.role !== 'OWNER') {
      return next(AppError.forbidden('Only the trip owner can do that', { code: 'OWNER_ONLY' }))
    }
    req.membership = membership
    next()
  }
}
