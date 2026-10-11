import { Router } from 'express'
import { z } from 'zod'
import { validate, uuidParam } from '../../middleware/validate.js'
import { leaderOnly } from '../../middleware/tripAccess.js'
import * as itinerary from './itinerary.service.js'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:30')
const stopFields = {
  dayId: uuidParam,
  placeId: uuidParam,
  startTime: time,
  durationMinutes: z.number().int().min(5, 'At least 5 minutes').max(720, 'At most 12 hours'),
  notes: z.string().trim().max(1000, 'Notes are too long'),
  costMinor: z.number().int().min(0).max(1_000_000_000),
}

const addSchema = z.object({
  ...stopFields,
  notes: stopFields.notes.default(''),
  costMinor: stopFields.costMinor.default(0),
  isLocked: z.boolean().default(false),
})

// isLocked has its own leader-only endpoint.
const updateSchema = z
  .strictObject({
    ...Object.fromEntries(Object.entries(stopFields).map(([k, v]) => [k, v.optional()])),
    version: z.number().int().min(1).optional(),
  })
  .refine((v) => Object.entries(v).some(([k, val]) => k !== 'version' && val !== undefined), 'Nothing to update')

const reorderSchema = z.object({
  items: z.array(z.object({ id: uuidParam, startTime: time })).max(100),
})

const planSchema = z.object({
  replaceDayId: uuidParam.optional(),
  items: z
    .array(z.object({ dayId: uuidParam, placeId: uuidParam, startTime: time, durationMinutes: stopFields.durationMinutes }))
    .max(100),
})

const itemParams = z.object({ tripId: uuidParam, itemId: uuidParam })
const dayParams = z.object({ tripId: uuidParam, dayId: uuidParam })

/** Mounted at /api/trips/:tripId/itinerary behind requireAuth + requireTripAccess() (any member). */
export const itineraryRouter = Router({ mergeParams: true })

const ctx = (req) => ({ tripId: req.valid.params.tripId, userId: req.user.id, role: req.tripRole, itemId: req.valid.params.itemId, dayId: req.valid.params.dayId })

itineraryRouter.get('/', async (req, res) => {
  res.json({ days: await itinerary.getItinerary(req.valid.params.tripId) })
})

itineraryRouter.post('/items', validate({ body: addSchema }), async (req, res) => {
  res.status(201).json({ item: await itinerary.addItem(ctx(req), req.body) })
})

itineraryRouter.patch('/items/:itemId', validate({ params: itemParams, body: updateSchema }), async (req, res) => {
  res.json({ item: await itinerary.updateItem(ctx(req), req.body) })
})

itineraryRouter.delete('/items/:itemId', validate({ params: itemParams }), async (req, res) => {
  await itinerary.deleteItem(ctx(req))
  res.status(204).end()
})

itineraryRouter.patch(
  '/items/:itemId/lock',
  validate({ params: itemParams, body: z.object({ locked: z.boolean() }) }),
  leaderOnly('Only the team leader can lock or unlock time slots.'),
  async (req, res) => {
    res.json({ item: await itinerary.setItemLock(ctx(req), req.body.locked) })
  },
)

itineraryRouter.put('/days/:dayId/order', validate({ params: dayParams, body: reorderSchema }), async (req, res) => {
  res.json({ items: await itinerary.reorderDay(ctx(req), req.body.items) })
})

itineraryRouter.post('/plan', validate({ body: planSchema }), async (req, res) => {
  res.status(201).json(await itinerary.applyPlan(ctx(req), req.body))
})
