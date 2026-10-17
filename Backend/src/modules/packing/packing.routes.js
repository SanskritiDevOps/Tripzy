import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { createItemSchema, itemParams, updateItemSchema } from './packing.schemas.js'
import * as packingService from './packing.service.js'

const ctx = (req) => ({ tripId: req.valid.params.tripId, itemId: req.valid.params.itemId, role: req.tripRole, userId: req.user.id })

/** Mounted at /api/trips/:tripId/packing behind requireAuth + requireTripAccess() (any member). */
export const packingRouter = Router({ mergeParams: true })

packingRouter.get('/', async (req, res) => {
  res.json({ items: await packingService.listItems(req.valid.params.tripId) })
})

packingRouter.post('/', validate({ body: createItemSchema }), async (req, res) => {
  res.status(201).json({ item: await packingService.addItem(ctx(req), req.body) })
})

packingRouter.patch('/:itemId', validate({ params: itemParams, body: updateItemSchema }), async (req, res) => {
  res.json({ item: await packingService.updateItem(ctx(req), req.body) })
})

packingRouter.delete('/:itemId', validate({ params: itemParams }), async (req, res) => {
  await packingService.deleteItem(ctx(req))
  res.status(204).end()
})

packingRouter.post('/reset', async (req, res) => {
  await packingService.resetList(ctx(req))
  res.status(204).end()
})
