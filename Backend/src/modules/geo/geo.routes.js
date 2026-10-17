import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { geoSearchLimiter } from '../../middleware/rateLimit.js'
import { validate } from '../../middleware/validate.js'
import { ATTRIBUTION, searchPlaces } from './geocoder.js'
import { searchQuery } from './geo.schemas.js'

/** Mounted at /api/geo. Logged-in users only. */
export const geoRouter = Router()
geoRouter.use(requireAuth({ message: 'Log in to search the map' }))

/** GET /api/geo/search?q=…&lat=&lng= — places from OpenStreetMap, preferring ones near lat/lng. */
geoRouter.get('/search', geoSearchLimiter, validate({ query: searchQuery }), async (req, res) => {
  const { q, lat, lng } = req.valid.query
  const results = await searchPlaces(q, { near: lat === undefined ? undefined : { lat, lng } })
  res.set('Cache-Control', 'private, max-age=300')
  res.json({ results, attribution: ATTRIBUTION })
})
