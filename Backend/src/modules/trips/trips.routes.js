import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireTripMember } from '../../middleware/tripMembership.js'
import { validate } from '../../middleware/validate.js'
import { createTripSchema, memberParams, tripParams, updateTripSchema } from './trips.schemas.js'
import * as controller from './trips.controller.js'

export const tripsRouter = Router()

// Every trip route needs a logged-in user (README §10.6).
tripsRouter.use(requireAuth({ message: 'Authentication required to plan or create a trip' }))

tripsRouter.post('/', validate({ body: createTripSchema }), controller.create)
tripsRouter.get('/', controller.list)
tripsRouter.get('/:tripId', validate({ params: tripParams }), requireTripMember(), controller.get)
tripsRouter.patch('/:tripId', validate({ params: tripParams, body: updateTripSchema }), requireTripMember({ ownerOnly: true }), controller.update)
tripsRouter.delete('/:tripId', validate({ params: tripParams }), requireTripMember({ ownerOnly: true }), controller.remove)
tripsRouter.delete('/:tripId/members/:userId', validate({ params: memberParams }), requireTripMember(), controller.removeMember)
