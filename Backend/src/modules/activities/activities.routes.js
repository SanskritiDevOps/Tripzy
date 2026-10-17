import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { listQuery } from './activities.schemas.js'
import * as activitiesService from './activities.service.js'

/** Mounted at /api/trips/:tripId/activities behind requireAuth + requireTripAccess() (any member). */
export const activitiesRouter = Router({ mergeParams: true })

activitiesRouter.get('/', validate({ query: listQuery }), async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await activitiesService.listActivities(req.valid.params.tripId, req.valid.query))
})
