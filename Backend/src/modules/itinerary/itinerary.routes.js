import { Router } from 'express'
import { z } from 'zod'
import { validate, uuidParam } from '../../middleware/validate.js'
import { leaderOnly } from '../../middleware/tripAccess.js'
import { aiBurstLimiter, aiDailyLimiter } from '../../middleware/rateLimit.js'
import * as itinerary from './itinerary.service.js'
import { aiStatus, generatePlan } from './planner/index.js'

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
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

// Saves a generated plan. replaceDayIds: those days' unlocked stops are cleared first
// (replaceDayId is the single-day form). notes carries the AI's tip for each stop.
const planSchema = z
  .object({
    replaceDayId: uuidParam.optional(),
    replaceDayIds: z.array(uuidParam).max(60).optional(),
    engine: z.enum(['gemini', 'code']).default('code'),
    items: z
      .array(
        z.object({
          dayId: uuidParam,
          placeId: uuidParam,
          startTime: time,
          durationMinutes: stopFields.durationMinutes,
          notes: stopFields.notes.default(''),
        }),
      )
      .max(150),
  })
  .refine((v) => new Set(v.items.map((i) => i.placeId)).size === v.items.length, { message: 'A place can only appear once in a plan', path: ['items'] })

const generateSchema = z
  .object({
    dayIds: z.array(uuidParam).min(1, 'Pick at least one day').max(30, 'Plan up to 30 days at a time'),
    mode: z.enum(['fill', 'replace']).default('fill'),
    places: z
      .array(z.object({ placeId: uuidParam, durationMinutes: stopFields.durationMinutes }))
      .min(1, 'Pick at least one place')
      .max(60, 'Pick up to 60 places'),
    dayStart: time.default('09:00'),
    dayEnd: time.default('20:30'),
    pace: z.enum(['relaxed', 'balanced', 'packed']).default('balanced'),
    notes: z.string().trim().max(500, 'Keep notes under 500 characters').default(''),
    engine: z.enum(['auto', 'code']).default('auto'),
  })
  .refine((v) => toMinutes(v.dayEnd) - toMinutes(v.dayStart) >= 120, { message: 'The day must be at least 2 hours long', path: ['dayEnd'] })

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
