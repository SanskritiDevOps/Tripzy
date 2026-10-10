import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'

export const LOCKED_MESSAGE = 'This place is locked by the team leader and cannot be modified.'

export function serializePlace(place) {
  return {
    id: place.id,
    tripId: place.tripId,
    addedBy: place.addedById,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
    notes: place.notes,
    durationMinutes: place.durationMinutes,
    isLocked: place.isLocked,
    lockedById: place.lockedById,
    lockedAt: place.lockedAt?.toISOString() ?? null,
    createdAt: place.createdAt.toISOString(),
    updatedAt: place.updatedAt.toISOString(),
  }
}

async function findPlace(tripId, placeId) {
  // Scoped by trip so a place id from another trip can't be reached through this one.
  const place = await prisma.place.findFirst({ where: { id: placeId, tripId } })
  if (!place) throw AppError.notFound('Place not found', { code: 'PLACE_NOT_FOUND' })
  return place
}

/** Locked places can only be changed by the team leader. */
function assertCanModify(place, role) {
  if (place.isLocked && role !== 'LEADER') throw AppError.forbidden(LOCKED_MESSAGE, { code: 'PLACE_LOCKED' })
}

export async function listPlaces(tripId) {
  const places = await prisma.place.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } })
  return places.map(serializePlace)
}

export async function createPlace(tripId, userId, input) {
  const place = await prisma.place.create({ data: { ...input, tripId, addedById: userId } })
  return serializePlace(place)
}

export async function updatePlace({ tripId, placeId, role }, input) {
  const place = await findPlace(tripId, placeId)
  assertCanModify(place, role)
  // Conditional write: if the leader locks the place between our read and this
  // write, the update matches nothing and the member gets the lock error.
  const { count } = await prisma.place.updateMany({
    where: { id: placeId, tripId, ...(role === 'LEADER' ? {} : { isLocked: false }) },
    data: input,
  })
  if (count === 0) throw AppError.forbidden(LOCKED_MESSAGE, { code: 'PLACE_LOCKED' })
  return serializePlace(await findPlace(tripId, placeId))
}

export async function deletePlace({ tripId, placeId, role }) {
  const place = await findPlace(tripId, placeId)
  assertCanModify(place, role)
  const { count } = await prisma.place.deleteMany({
    where: { id: placeId, tripId, ...(role === 'LEADER' ? {} : { isLocked: false }) },
  })
  if (count === 0) throw AppError.forbidden(LOCKED_MESSAGE, { code: 'PLACE_LOCKED' })
}

export async function setLock({ tripId, placeId, userId }, locked) {
  await findPlace(tripId, placeId)
  const place = await prisma.place.update({
    where: { id: placeId },
    data: locked ? { isLocked: true, lockedById: userId, lockedAt: new Date() } : { isLocked: false, lockedById: null, lockedAt: null },
  })
  return serializePlace(place)
}
