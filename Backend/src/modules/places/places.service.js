import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'
import { ACTIONS, logTripActivity } from '../activities/activities.service.js'

const LOCKED_MESSAGE = 'This place is locked by the team leader and cannot be modified.'

function serializePlace(place) {
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
    // Every member's vote, so clients can show totals, "my vote" and who voted.
    votes: place.votes?.map((v) => ({ userId: v.userId, value: v.value })) ?? [],
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
  const places = await prisma.place.findMany({ where: { tripId }, include: { votes: true }, orderBy: { createdAt: 'asc' } })
  return places.map(serializePlace)
}

// Each change and its activity entry are written in one transaction.

export async function createPlace(tripId, userId, input) {
  const place = await prisma.$transaction(async (tx) => {
    const created = await tx.place.create({ data: { ...input, tripId, addedById: userId } })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.PLACE_ADDED, details: { placeId: created.id, placeName: created.name } })
    return created
  })
  return serializePlace(place)
}

export async function updatePlace({ tripId, placeId, role, userId }, input) {
  const place = await findPlace(tripId, placeId)
  assertCanModify(place, role)
  const fields = Object.keys(input).filter((key) => input[key] !== undefined && input[key] !== place[key])
  await prisma.$transaction(async (tx) => {
    // Conditional write: if the leader locks the place between our read and this
    // write, the update matches nothing and the member gets the lock error.
    const { count } = await tx.place.updateMany({
      where: { id: placeId, tripId, ...(role === 'LEADER' ? {} : { isLocked: false }) },
      data: input,
    })
    if (count === 0) throw AppError.forbidden(LOCKED_MESSAGE, { code: 'PLACE_LOCKED' })
    if (fields.length) {
      await logTripActivity(tx, { tripId, userId, action: ACTIONS.PLACE_UPDATED, details: { placeId, placeName: input.name ?? place.name, fields } })
    }
  })
  return serializePlace(await findPlace(tripId, placeId))
}

export async function deletePlace({ tripId, placeId, role, userId }) {
  const place = await findPlace(tripId, placeId)
  assertCanModify(place, role)
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.place.deleteMany({
      where: { id: placeId, tripId, ...(role === 'LEADER' ? {} : { isLocked: false }) },
    })
    if (count === 0) throw AppError.forbidden(LOCKED_MESSAGE, { code: 'PLACE_LOCKED' })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.PLACE_DELETED, details: { placeId, placeName: place.name } })
  })
}

export async function setLock({ tripId, placeId, userId }, locked) {
  const current = await findPlace(tripId, placeId)
  if (current.isLocked === locked) return serializePlace(current) // no change, nothing to log
  const place = await prisma.$transaction(async (tx) => {
    const updated = await tx.place.update({
      where: { id: placeId },
      data: locked ? { isLocked: true, lockedById: userId, lockedAt: new Date() } : { isLocked: false, lockedById: null, lockedAt: null },
    })
    await logTripActivity(tx, {
      tripId,
      userId,
      action: locked ? ACTIONS.PLACE_LOCKED : ACTIONS.PLACE_UNLOCKED,
      details: { placeId, placeName: updated.name },
    })
    return updated
  })
  return serializePlace(place)
}

// Votes

async function assertVotingOpen(tripId) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { votingDeadline: true } })
  if (trip?.votingDeadline && trip.votingDeadline <= new Date()) {
    throw AppError.conflict('Voting has closed for this trip.', { code: 'VOTING_CLOSED' })
  }
}

async function placeWithVotes(tripId, placeId) {
  const place = await prisma.place.findFirst({ where: { id: placeId, tripId }, include: { votes: true } })
  if (!place) throw AppError.notFound('Place not found', { code: 'PLACE_NOT_FOUND' })
  return serializePlace(place)
}

/** Casts or changes the user's vote (+1 / -1) as one upsert. */
export async function castVote({ tripId, placeId, userId }, value) {
  const place = await findPlace(tripId, placeId)
  await assertVotingOpen(tripId)
  await prisma.$transaction(async (tx) => {
    const existing = await tx.vote.findUnique({ where: { placeId_userId: { placeId, userId } } })
    if (existing?.value === value) return
    await tx.vote.upsert({
      where: { placeId_userId: { placeId, userId } },
      create: { placeId, userId, value },
      update: { value },
    })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.VOTED, details: { placeId, placeName: place.name, value } })
  })
  return placeWithVotes(tripId, placeId)
}

export async function removeVote({ tripId, placeId, userId }) {
  await findPlace(tripId, placeId)
  await assertVotingOpen(tripId)
  await prisma.vote.deleteMany({ where: { placeId, userId } })
  return placeWithVotes(tripId, placeId)
}

/** Leader only: ends voting now and locks every place with a positive score. */
export async function closeVoting(tripId, userId) {
  return prisma.$transaction(async (tx) => {
    const scores = await tx.vote.groupBy({ by: ['placeId'], where: { place: { tripId } }, _sum: { value: true } })
    const winners = scores.filter((s) => (s._sum.value ?? 0) > 0).map((s) => s.placeId)
    const { count } = await tx.place.updateMany({
      where: { tripId, id: { in: winners }, isLocked: false },
      data: { isLocked: true, lockedById: userId, lockedAt: new Date() },
    })
    await tx.trip.update({ where: { id: tripId }, data: { votingDeadline: new Date() } })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.VOTING_CLOSED, details: { lockedCount: count } })
    return { lockedCount: count }
  })
}

/** Leader only: reopens voting. Existing locks stay; the leader unlocks places individually. */
export async function reopenVoting(tripId, userId) {
  await prisma.$transaction(async (tx) => {
    await tx.trip.update({ where: { id: tripId }, data: { votingDeadline: null } })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.VOTING_REOPENED })
  })
}
