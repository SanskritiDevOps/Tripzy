import { z } from 'zod'
import { uuidParam } from '../../middleware/validate.js'

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

export const addItemSchema = z.object({
  ...stopFields,
  notes: stopFields.notes.default(''),
  costMinor: stopFields.costMinor.default(0),
  isLocked: z.boolean().default(false),
})

// isLocked has its own leader-only endpoint.
export const updateItemSchema = z
  .strictObject({
    ...Object.fromEntries(Object.entries(stopFields).map(([k, v]) => [k, v.optional()])),
    version: z.number().int().min(1).optional(),
  })
  .refine((v) => Object.entries(v).some(([k, val]) => k !== 'version' && val !== undefined), 'Nothing to update')

export const reorderSchema = z.object({
  items: z.array(z.object({ id: uuidParam, startTime: time })).max(100),
})

// Saves a generated plan. replaceDayIds: those days' unlocked stops are cleared first
// (replaceDayId is the single-day form). notes carries the AI's tip for each stop.
export const planSchema = z
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

export const generateSchema = z
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

export const itemParams = z.object({ tripId: uuidParam, itemId: uuidParam })
export const dayParams = z.object({ tripId: uuidParam, dayId: uuidParam })
export const lockSchema = z.object({ locked: z.boolean() })
