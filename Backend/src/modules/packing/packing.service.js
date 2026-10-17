import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'
import { ACTIONS, logTripActivity } from '../activities/activities.service.js'

const serializeItem = (i) => ({
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

async function assertMember(tripId, userId) {
  if (!userId) return
  const member = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } })
  if (!member) throw AppError.badRequest('That person isn’t on this trip.', { code: 'VALIDATION_ERROR', details: { ownerId: 'Not a trip member' } })
}

export async function listItems(tripId) {
  const items = await prisma.packingItem.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } })
  return items.map(serializeItem)
}

export async function addItem({ tripId, userId }, input) {
  await assertMember(tripId, input.ownerId)
  const duplicate = await prisma.packingItem.findFirst({ where: { tripId, label: { equals: input.label, mode: 'insensitive' } } })
  if (duplicate) throw AppError.conflict('That’s already on the list.', { code: 'DUPLICATE', details: { label: 'Already on the list' } })
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.packingItem.create({ data: { ...input, tripId, addedById: userId } })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.PACKING_ITEM_ADDED, details: { itemId: created.id, label: created.label } })
    return created
  })
  return serializeItem(item)
}

/** Any member: tick/untick, rename, recategorise, (re)assign. */
export async function updateItem({ tripId, userId, itemId }, changes) {
  const current = await findItem(tripId, itemId)
  if (changes.ownerId !== undefined) await assertMember(tripId, changes.ownerId)
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.packingItem.update({ where: { id: itemId }, data: changes })
    // Only "packed" is worth a feed entry; unticking and edits stay quiet.
    if (changes.packed === true && !current.packed) {
      await logTripActivity(tx, { tripId, userId, action: ACTIONS.PACKING_ITEM_PACKED, details: { itemId, label: updated.label } })
    }
    return updated
  })
  return serializeItem(item)
}

/** Whoever added the item, or the team leader. */
export async function deleteItem({ tripId, userId, role, itemId }) {
  const item = await findItem(tripId, itemId)
  if (role !== 'LEADER' && item.addedById !== userId) {
    throw AppError.forbidden('Only the person who added this item or the team leader can remove it.', { code: 'NOT_ITEM_OWNER' })
  }
  await prisma.$transaction(async (tx) => {
    await tx.packingItem.delete({ where: { id: itemId } })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.PACKING_ITEM_DELETED, details: { itemId, label: item.label } })
  })
}

/** Unticks everything (e.g. packing for the trip home). */
export async function resetList({ tripId, userId }) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.packingItem.updateMany({ where: { tripId, packed: true }, data: { packed: false } })
    if (count) await logTripActivity(tx, { tripId, userId, action: ACTIONS.PACKING_RESET, details: { count } })
  })
}
