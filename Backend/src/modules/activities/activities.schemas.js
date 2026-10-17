import { z } from 'zod'
import { uuidParam } from '../../middleware/validate.js'

export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: uuidParam.optional(),
})
