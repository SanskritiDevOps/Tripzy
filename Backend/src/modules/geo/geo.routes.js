import { Router } from 'express'
import { z } from 'zod'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { env } from '../../config/env.js'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { ATTRIBUTION, searchPlaces } from './geocoder.js'

const searchQuery = z
  .object({
    q: z.string({ error: 'Type what to search for' }).trim().min(2, 'Type at least 2 characters').max(200),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Send both lat and lng', path: ['lat'] })

/** Searches hit a shared, rate-limited public service — limit each account. */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many map searches — wait a minute and try again.', code: 'RATE_LIMITED' },
})

/** Mounted at /api/geo. Logged-in users only. */
export const geoRouter = Router()
geoRouter.use(requireAuth({ message: 'Log in to search the map' }))

/** GET /api/geo/search?q=…&lat=&lng= — places from OpenStreetMap, preferring ones near lat/lng. */
geoRouter.get('/search', searchLimiter, validate({ query: searchQuery }), async (req, res) => {
  const { q, lat, lng } = req.valid.query
  const results = await searchPlaces(q, { near: lat === undefined ? undefined : { lat, lng } })
  res.set('Cache-Control', 'private, max-age=300')
  res.json({ results, attribution: ATTRIBUTION })
})
