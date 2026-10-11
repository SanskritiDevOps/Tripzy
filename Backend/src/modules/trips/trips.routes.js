import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { leaderOnly, requireTripAccess } from '../../middleware/tripAccess.js'
import { validate } from '../../middleware/validate.js'
import { budgetSchema, createTripSchema, memberParams, tripParams, updateTripSchema } from './trips.schemas.js'
import * as controller from './trips.controller.js'
import { placesRouter, votingRouter } from '../places/places.routes.js'
import { itineraryRouter } from '../itinerary/itinerary.routes.js'
import { expensesRouter } from '../expenses/expenses.routes.js'
import { packingRouter } from '../packing/packing.routes.js'
import { invitesRouter, joinTrip, tokenSchema } from '../invites/invites.routes.js'
import { activitiesRouter } from '../activities/activities.routes.js'

export const tripsRouter = Router()

// Every trip route needs a logged-in user (README §10.6).
tripsRouter.use(requireAuth({ message: 'Authentication required to plan or create a trip' }))

tripsRouter.post('/', validate({ body: createTripSchema }), controller.create)
tripsRouter.get('/', controller.list)
// Accept an invite (any logged-in user whose email matches the invite).
tripsRouter.post('/join', validate({ body: tokenSchema }), joinTrip)

// Permission matrix:
//   any member  → view, edit trip details (name, destination, dates, group type)
//   leader only → budget, delete trip, invites, removing other members
tripsRouter.get('/:tripId', validate({ params: tripParams }), requireTripAccess(), controller.get)
tripsRouter.patch('/:tripId', validate({ params: tripParams, body: updateTripSchema }), requireTripAccess(), controller.update)
tripsRouter.patch(
  '/:tripId/budget',
  validate({ params: tripParams, body: budgetSchema }),
  leaderOnly('Only the team leader can set the trip budget.'),
  controller.updateBudget,
)
tripsRouter.delete('/:tripId', validate({ params: tripParams }), leaderOnly('Only the team leader can delete the trip.'), controller.remove)
tripsRouter.delete('/:tripId/members/:userId', validate({ params: memberParams }), requireTripAccess(), controller.removeMember)

tripsRouter.use('/:tripId/places', validate({ params: tripParams }), requireTripAccess(), placesRouter)
tripsRouter.use('/:tripId/activities', validate({ params: tripParams }), requireTripAccess(), activitiesRouter)
tripsRouter.use('/:tripId/voting', validate({ params: tripParams }), leaderOnly('Only the team leader can open or close voting.'), votingRouter)
tripsRouter.use('/:tripId/itinerary', validate({ params: tripParams }), requireTripAccess(), itineraryRouter)
tripsRouter.use('/:tripId/packing', validate({ params: tripParams }), requireTripAccess(), packingRouter)
// /expenses, /balances, /settlements
tripsRouter.use('/:tripId', validate({ params: tripParams }), requireTripAccess(), expensesRouter)
tripsRouter.use('/:tripId/invites', validate({ params: tripParams }), leaderOnly('Only the team leader can manage invitations.'), invitesRouter)
