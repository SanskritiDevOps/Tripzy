import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { leaderOnly } from '../../middleware/tripAccess.js'
import { aiBurstLimiter, aiDailyLimiter } from '../../middleware/rateLimit.js'
import { addItemSchema, dayParams, generateSchema, itemParams, lockSchema, planSchema, reorderSchema, updateItemSchema } from './itinerary.schemas.js'
import * as itineraryService from './itinerary.service.js'
import { aiStatus, generatePlan } from './planner/index.js'

/** Mounted at /api/trips/:tripId/itinerary behind requireAuth + requireTripAccess() (any member). */
export const itineraryRouter = Router({ mergeParams: true })

const ctx = (req) => ({ tripId: req.valid.params.tripId, userId: req.user.id, role: req.tripRole, itemId: req.valid.params.itemId, dayId: req.valid.params.dayId })

itineraryRouter.get('/', async (req, res) => {
  res.json({ days: await itineraryService.getItinerary(req.valid.params.tripId) })
})

itineraryRouter.post('/items', validate({ body: addItemSchema }), async (req, res) => {
  res.status(201).json({ item: await itineraryService.addItem(ctx(req), req.body) })
})

itineraryRouter.patch('/items/:itemId', validate({ params: itemParams, body: updateItemSchema }), async (req, res) => {
  res.json({ item: await itineraryService.updateItem(ctx(req), req.body) })
})

itineraryRouter.delete('/items/:itemId', validate({ params: itemParams }), async (req, res) => {
  await itineraryService.deleteItem(ctx(req))
  res.status(204).end()
})

itineraryRouter.patch(
  '/items/:itemId/lock',
  validate({ params: itemParams, body: lockSchema }),
  leaderOnly('Only the team leader can lock or unlock time slots.'),
  async (req, res) => {
    res.json({ item: await itineraryService.setItemLock(ctx(req), req.body.locked) })
  },
)

itineraryRouter.put('/days/:dayId/order', validate({ params: dayParams, body: reorderSchema }), async (req, res) => {
  res.json({ items: await itineraryService.reorderDay(ctx(req), req.body.items) })
})

itineraryRouter.post('/plan', validate({ body: planSchema }), async (req, res) => {
  res.status(201).json(await itineraryService.applyPlan(ctx(req), req.body))
})

/** Whether AI planning is available (Gemini key configured) and the planner defaults. */
itineraryRouter.get('/planner', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ ai: aiStatus(), defaults: { dayStart: '09:00', dayEnd: '20:30', pace: 'balanced' } })
})

/**
 * Generates a draft plan (AI with code validation, or code-only). Saves nothing —
 * the client previews it and saves through POST /plan — so no live broadcast.
 */
itineraryRouter.post('/generate', aiBurstLimiter, aiDailyLimiter, validate({ body: generateSchema }), async (req, res) => {
  res.locals.skipBroadcast = true
  const draft = await generatePlan(req.valid.params.tripId, req.body, req.log)
  req.log.info({ tripId: req.valid.params.tripId, engine: draft.engine, fallback: draft.fallbackCode }, 'itinerary draft generated')
  res.json(draft)
})
