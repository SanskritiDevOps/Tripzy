import { z } from 'zod'
import { uuidParam } from '../../middleware/validate.js'

const PLACE_CATEGORIES = ['sight', 'food', 'stay', 'activity', 'transit', 'other']

const placeFields = {
  name: z.string().trim().min(2, 'Give the place a name').max(120, 'Name is too long'),
  address: z.string().trim().max(300, 'Address is too long'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.enum(PLACE_CATEGORIES, { error: 'Pick a valid category' }),
  notes: z.string().trim().max(2000, 'Notes are too long'),
  durationMinutes: z.number().int().min(5, 'At least 5 minutes').max(720, 'At most 12 hours'),
}

export const createPlaceSchema = z.object({
  ...placeFields,
  address: placeFields.address.default(''),
  category: placeFields.category.default('other'),
  notes: placeFields.notes.default(''),
  durationMinutes: placeFields.durationMinutes.default(60),
})

// isLocked is not editable here — it has its own leader-only endpoint.
export const updatePlaceSchema = z
  .strictObject(Object.fromEntries(Object.entries(placeFields).map(([key, schema]) => [key, schema.optional()])))
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'Nothing to update')

export const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)], { error: 'Vote must be 1 or -1' }) })

export const lockSchema = z.object({ locked: z.boolean({ error: '`locked` must be true or false' }) })

export const placeParams = z.object({ tripId: uuidParam, placeId: uuidParam })
