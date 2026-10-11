import { Router } from 'express'
import { z } from 'zod'
import { validate, uuidParam } from '../../middleware/validate.js'
import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'
import { ACTIONS, logTripActivity } from '../activities/activities.service.js'

const CATEGORIES = ['documents', 'clothing', 'toiletries', 'electronics', 'health', 'gear']

const fields = {
  label: z.string().trim().min(2, 'Type an item to add').max(80, 'Keep it under 80 characters'),
  category: z.enum(CATEGORIES),
  ownerId: uuidParam.nullable(),
}
const createSchema = z.object({ ...fields, category: fields.category.default('gear'), ownerId: fields.ownerId.default(null) })
const updateSchema = z
  .strictObject({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])), packed: z.boolean().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update')
const itemParams = z.object({ tripId: uuidParam, itemId: uuidParam })

const serialize = (i) => ({
  id: i.id,
  tripId: i.tripId,
  label: i.label,
  category: i.category,
  packed: i.packed,
  ownerId: i.ownerId,
  addedBy: i.addedById,
  createdAt: i.createdAt.toISOString(),
  updatedAt: i.updatedAt.toISOString(),
})

async function findItem(tripId, itemId) {
  const item = await prisma.packingItem.findFirst({ where: { id: itemId, tripId } })
  if (!item) throw AppError.notFound('Packing item not found', { code: 'PACKING_ITEM_NOT_FOUND' })
  return item
}

async function assertMember(tripId, userId, field) {
  if (!userId) return
  const member = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } })
  if (!member) throw AppError.badRequest('That person isn’t on this trip.', { code: 'VALIDATION_ERROR', details: { [field]: 'Not a trip member' } })
}

/** Mounted at /api/trips/:tripId/packing behind requireAuth + requireTripAccess(). */
export const packingRouter = Router({ mergeParams: true })

packingRouter.get('/', async (req, res) => {
  const items = await prisma.packingItem.findMany({ where: { tripId: req.valid.params.tripId }, orderBy: { createdAt: 'asc' } })
  res.json({ items: items.map(serialize) })
})

// Any member
packingRouter.post('/', validate({ body: createSchema }), async (req, res) => {
  const { tripId } = req.valid.params
  await assertMember(tripId, req.body.ownerId, 'ownerId')
  const duplicate = await prisma.packingItem.findFirst({ where: { tripId, label: { equals: req.body.label, mode: 'insensitive' } } })
  if (duplicate) throw AppError.conflict('That’s already on the list.', { code: 'DUPLICATE', details: { label: 'Already on the list' } })
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.packingItem.create({ data: { ...req.body, tripId, addedById: req.user.id } })
    await logTripActivity(tx, { tripId, userId: req.user.id, action: ACTIONS.PACKING_ITEM_ADDED, details: { itemId: created.id, label: created.label } })
    return created
  })
  res.status(201).json({ item: serialize(item) })
})

// Any member: tick/untick, rename, recategorise, (re)assign
packingRouter.patch('/:itemId', validate({ params: itemParams, body: updateSchema }), async (req, res) => {
  const { tripId, itemId } = req.valid.params
  const current = await findItem(tripId, itemId)
  if (req.body.ownerId !== undefined) await assertMember(tripId, req.body.ownerId, 'ownerId')
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.packingItem.update({ where: { id: itemId }, data: req.body })
    // Only "packed" is worth a feed entry; unticking and edits stay quiet.
    if (req.body.packed === true && !current.packed) {
      await logTripActivity(tx, { tripId, userId: req.user.id, action: ACTIONS.PACKING_ITEM_PACKED, details: { itemId, label: updated.label } })
    }
    return updated
  })
  res.json({ item: serialize(item) })
})

// Whoever added it, or the team leader
packingRouter.delete('/:itemId', validate({ params: itemParams }), async (req, res) => {
  const { tripId, itemId } = req.valid.params
  const item = await findItem(tripId, itemId)
  if (req.tripRole !== 'LEADER' && item.addedById !== req.user.id) {
    throw AppError.forbidden('Only the person who added this item or the team leader can remove it.', { code: 'NOT_ITEM_OWNER' })
  }
  await prisma.$transaction(async (tx) => {
    await tx.packingItem.delete({ where: { id: itemId } })
    await logTripActivity(tx, { tripId, userId: req.user.id, action: ACTIONS.PACKING_ITEM_DELETED, details: { itemId, label: item.label } })
  })
  res.status(204).end()
})

// Any member: uncheck everything (e.g. packing for the trip home)
packingRouter.post('/reset', async (req, res) => {
  const { tripId } = req.valid.params
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.packingItem.updateMany({ where: { tripId, packed: true }, data: { packed: false } })
    if (count) await logTripActivity(tx, { tripId, userId: req.user.id, action: ACTIONS.PACKING_RESET, details: { count } })
  })
  res.status(204).end()
})
