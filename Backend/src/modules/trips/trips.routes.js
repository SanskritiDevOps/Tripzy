import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { leaderOnly, requireTripAccess } from '../../middleware/tripAccess.js'
import { validate } from '../../middleware/validate.js'
import { broadcastTripChange as broadcast, originSocketId } from '../../middleware/broadcast.js'
import { emitTripChanged, emitTripDeleted, revokeTripAccess } from '../../realtime/io.js'
import { budgetSchema, createTripSchema, memberParams, tripParams, updateTripSchema } from './trips.schemas.js'
import * as tripsService from './trips.service.js'
import { placesRouter, votingRouter } from '../places/places.routes.js'
import { itineraryRouter } from '../itinerary/itinerary.routes.js'
import { expensesRouter } from '../expenses/expenses.routes.js'
import { packingRouter } from '../packing/packing.routes.js'
import { invitesRouter, joinTrip } from '../invites/invites.routes.js'
import { tokenSchema } from '../invites/invites.schemas.js'
import { activitiesRouter } from '../activities/activities.routes.js'

const actorOf = (req) => ({ id: req.user.id, name: req.user.name })

export const tripsRouter = Router()

// Every trip route needs a logged-in user.
tripsRouter.use(requireAuth({ message: 'Authentication required to plan or create a trip' }))

tripsRouter.post('/', validate({ body: createTripSchema }), async (req, res) => {
  const trip = await tripsService.createTrip(req.user.id, req.body)
  req.log.info({ tripId: trip.id, userId: req.user.id }, 'trip created')
  res.status(201).json({ trip })
})

tripsRouter.get('/', async (req, res) => {
  res.json({ trips: await tripsService.listTripsForUser(req.user.id) })
})

// Accept an invite (any logged-in user whose email matches the invite).
tripsRouter.post('/join', validate({ body: tokenSchema }), joinTrip)

// Permission matrix:
//   any member  → view, edit trip details (name, destination, dates, group type)
//   leader only → budget, delete trip, invites, removing other members
tripsRouter.get('/:tripId', validate({ params: tripParams }), requireTripAccess(), async (req, res) => {
  res.json({ trip: await tripsService.getTrip(req.valid.params.tripId, req.user.id) })
})

tripsRouter.patch(
  '/:tripId',
  validate({ params: tripParams, body: updateTripSchema }),
  requireTripAccess(),
  broadcast('trip', 'itinerary'),
  async (req, res) => {
    res.json({ trip: await tripsService.updateTrip(req.valid.params.tripId, req.user.id, req.body) })
  },
)

tripsRouter.patch(
  '/:tripId/budget',
  validate({ params: tripParams, body: budgetSchema }),
  leaderOnly('Only the team leader can set the trip budget.'),
  broadcast('trip'),
  async (req, res) => {
    const trip = await tripsService.updateBudget(req.valid.params.tripId, req.user.id, req.body.budgetMinor)
    req.log.info({ tripId: trip.id, userId: req.user.id, budgetMinor: trip.budgetMinor }, 'trip budget updated')
    res.json({ trip })
  },
)

tripsRouter.delete('/:tripId', validate({ params: tripParams }), leaderOnly('Only the team leader can delete the trip.'), async (req, res) => {
  const { tripId } = req.valid.params
  await tripsService.deleteTrip(tripId)
  req.log.info({ tripId, userId: req.user.id }, 'trip deleted')
  emitTripDeleted(tripId, actorOf(req))
  res.status(204).end()
})

// The leader removes a member, or a member leaves.
tripsRouter.delete('/:tripId/members/:userId', validate({ params: memberParams }), requireTripAccess(), async (req, res) => {
  const { tripId, userId } = req.valid.params
  await tripsService.removeMember({ tripId, targetUserId: userId, actor: req.membership })
  revokeTripAccess(tripId, userId, { reason: userId === req.user.id ? 'left' : 'removed', actor: actorOf(req) })
  emitTripChanged(tripId, { scopes: ['trip'], actor: actorOf(req), exceptSocketId: originSocketId(req) })
  res.status(204).end()
})

// After each successful write, broadcast() tells the trip's other connected
// members which data to re-fetch (see src/realtime). Deleting a place also
// removes its stops, so places changes refresh the itinerary too.
tripsRouter.use('/:tripId/places', validate({ params: tripParams }), requireTripAccess(), broadcast('places', 'itinerary'), placesRouter)
tripsRouter.use('/:tripId/activities', validate({ params: tripParams }), requireTripAccess(), activitiesRouter)
tripsRouter.use(
  '/:tripId/voting',
  validate({ params: tripParams }),
  leaderOnly('Only the team leader can open or close voting.'),
  broadcast('trip', 'places'),
  votingRouter,
)
tripsRouter.use('/:tripId/itinerary', validate({ params: tripParams }), requireTripAccess(), broadcast('itinerary'), itineraryRouter)
tripsRouter.use('/:tripId/packing', validate({ params: tripParams }), requireTripAccess(), broadcast('packing'), packingRouter)
tripsRouter.use('/:tripId/invites', validate({ params: tripParams }), leaderOnly('Only the team leader can manage invitations.'), broadcast('invites'), invitesRouter)
// /expenses, /balances, /settlements — mounted last because '/:tripId' matches every sub-path.
tripsRouter.use('/:tripId', validate({ params: tripParams }), requireTripAccess(), broadcast('expenses'), expensesRouter)
