import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { authLimiter } from '../../middleware/rateLimit.js'
import { createInviteSchema, inviteParams, tokenSchema } from './invites.schemas.js'
import * as invitesService from './invites.service.js'
import { originSocketId } from '../../middleware/broadcast.js'
import { emitTripChanged } from '../../realtime/io.js'

/** Mounted at /api/trips/:tripId/invites behind requireAuth + leader-only access. */
export const invitesRouter = Router({ mergeParams: true })

invitesRouter.post('/', validate({ body: createInviteSchema }), async (req, res) => {
  const result = await invitesService.createInvite({ tripId: req.valid.params.tripId, inviterId: req.user.id, email: req.body.email })
  req.log.info({ tripId: req.valid.params.tripId, inviteId: result.invite.id, emailed: result.emailDelivered }, 'trip invite created')
  res.status(201).json(result)
})

invitesRouter.get('/', async (req, res) => {
  res.json({ invites: await invitesService.listInvites(req.valid.params.tripId) })
})

invitesRouter.delete('/:inviteId', validate({ params: inviteParams }), async (req, res) => {
  await invitesService.revokeInvite(req.valid.params.tripId, req.valid.params.inviteId)
  res.status(204).end()
})

/** POST /api/trips/join — authenticated; mounted on the trips router. */
export async function joinTrip(req, res) {
  const trip = await invitesService.acceptInvite(req.user, req.body.token)
  req.log.info({ tripId: trip.id, userId: req.user.id }, 'joined trip via invite')
  // The member list changed — show the new traveller to everyone already in the trip.
  emitTripChanged(trip.id, { scopes: ['trip'], actor: { id: req.user.id, name: req.user.name }, exceptSocketId: originSocketId(req) })
  res.json({ trip })
}

/** GET /api/invites/:token — public preview for the join page. */
export const publicInvitesRouter = Router()
publicInvitesRouter.get('/:token', authLimiter, validate({ params: tokenSchema }), async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ invite: await invitesService.previewInvite(req.valid.params.token) })
})
