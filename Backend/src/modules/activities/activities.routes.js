import { Router } from 'express'
import { z } from 'zod'
import { validate, uuidParam } from '../../middleware/validate.js'
import { listActivities } from './activities.service.js'

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: uuidParam.optional(),
})

/** Mounted at /api/trips/:tripId/activities behind requireAuth + requireTripAccess() (any member). */
export const activitiesRouter = Router({ mergeParams: true })

activitiesRouter.get('/', validate({ query: listQuery }), async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await listActivities(req.valid.params.tripId, req.valid.query))
})
