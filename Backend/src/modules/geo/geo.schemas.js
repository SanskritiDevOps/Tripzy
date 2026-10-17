import { z } from 'zod'

export const searchQuery = z
  .object({
    q: z.string({ error: 'Type what to search for' }).trim().min(2, 'Type at least 2 characters').max(200),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Send both lat and lng', path: ['lat'] })
