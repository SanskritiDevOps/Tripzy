import { z } from 'zod'
import { uuidParam } from '../../middleware/validate.js'

const CATEGORIES = ['documents', 'clothing', 'toiletries', 'electronics', 'health', 'gear']

const fields = {
  label: z.string().trim().min(2, 'Type an item to add').max(80, 'Keep it under 80 characters'),
  category: z.enum(CATEGORIES),
  ownerId: uuidParam.nullable(),
}

export const createItemSchema = z.object({ ...fields, category: fields.category.default('gear'), ownerId: fields.ownerId.default(null) })

export const updateItemSchema = z
  .strictObject({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])), packed: z.boolean().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update')

export const itemParams = z.object({ tripId: uuidParam, itemId: uuidParam })
