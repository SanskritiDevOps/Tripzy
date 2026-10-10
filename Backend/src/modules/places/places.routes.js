import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { leaderOnly } from '../../middleware/tripAccess.js'
import { createPlaceSchema, lockSchema, placeParams, updatePlaceSchema } from './places.schemas.js'
import * as placesService from './places.service.js'

// Mounted at /api/trips/:tripId/places behind requireAuth + requireTripAccess(),
// so every handler already knows the user is a member and has req.tripRole.
export const placesRouter = Router({ mergeParams: true })

const ctx = (req) => ({ tripId: req.valid.params.tripId, placeId: req.valid.params.placeId, role: req.tripRole, userId: req.user.id })

// Any member
placesRouter.get('/', async (req, res) => {
  res.json({ places: await placesService.listPlaces(req.valid.params.tripId) })
})

placesRouter.post('/', validate({ body: createPlaceSchema }), async (req, res) => {
  const place = await placesService.createPlace(req.valid.params.tripId, req.user.id, req.body)
  res.status(201).json({ place })
})

// Any member, unless the place is locked (then leader only)
placesRouter.patch('/:placeId', validate({ params: placeParams, body: updatePlaceSchema }), async (req, res) => {
  res.json({ place: await placesService.updatePlace(ctx(req), req.body) })
})

placesRouter.delete('/:placeId', validate({ params: placeParams }), async (req, res) => {
  await placesService.deletePlace(ctx(req))
  res.status(204).end()
})

// Leader only
placesRouter.patch(
  '/:placeId/lock',
  validate({ params: placeParams, body: lockSchema }),
  leaderOnly('Only the team leader can lock or unlock places.'),
  async (req, res) => {
    const place = await placesService.setLock(ctx(req), req.body.locked)
    req.log.info({ placeId: place.id, locked: place.isLocked, userId: req.user.id }, 'place lock changed')
    res.json({ place })
  },
)
