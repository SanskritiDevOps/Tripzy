import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'
import { ACTIONS, logTripActivity } from '../activities/activities.service.js'
import { syncDays } from '../itinerary/itinerary.service.js'

const STARTER_PACKING = [
  ['documents', 'ID / passport'],
  ['documents', 'Tickets & bookings'],
  ['clothing', 'Comfortable shoes'],
  ['toiletries', 'Toiletries kit'],
  ['electronics', 'Phone charger'],
  ['electronics', 'Power bank'],
  ['health', 'Basic medicines'],
  ['gear', 'Reusable water bottle'],
]

const asDate = (iso) => new Date(`${iso}T00:00:00Z`)
const asIso = (date) => date.toISOString().slice(0, 10)

const memberInclude = {
  members: {
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: 'asc' },
  },
}

/** API shape for a trip: dates as YYYY-MM-DD, money as a JSON number. */
export function serializeTrip(trip, currentUserId) {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: asIso(trip.startDate),
    endDate: asIso(trip.endDate),
    currency: trip.currency,
    budgetMinor: Number(trip.budgetMinor),
    groupType: trip.groupType,
    ownerId: trip.ownerId,
    votingDeadline: trip.votingDeadline?.toISOString() ?? null,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    role: trip.members?.find((m) => m.userId === currentUserId)?.role ?? null,
    members: trip.members?.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt.toISOString() })) ?? [],
  }
}

function toData(input) {
  const data = { ...input }
  if (input.startDate) data.startDate = asDate(input.startDate)
  if (input.endDate) data.endDate = asDate(input.endDate)
  if (input.budgetMinor !== undefined) data.budgetMinor = BigInt(input.budgetMinor)
  return data
}

/** The authenticated user becomes the team leader and first member in one write. */
export async function createTrip(userId, input) {
  const trip = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        ...toData(input),
        ownerId: userId,
        members: { create: { userId, role: 'LEADER' } },
      },
      include: memberInclude,
    })
    await syncDays(tx, created)
    await tx.packingItem.createMany({
      data: STARTER_PACKING.map(([category, label]) => ({ tripId: created.id, category, label, addedById: userId })),
    })
    await logTripActivity(tx, { tripId: created.id, userId, action: ACTIONS.TRIP_CREATED, details: { tripName: created.name } })
    return created
  })
  return serializeTrip(trip, userId)
}

export async function listTripsForUser(userId) {
  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId } } },
    include: memberInclude,
    orderBy: { startDate: 'asc' },
  })
  return trips.map((trip) => serializeTrip(trip, userId))
}

export async function getTrip(tripId, userId) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: memberInclude })
  if (!trip) throw AppError.notFound('Trip not found', { code: 'TRIP_NOT_FOUND' })
  return serializeTrip(trip, userId)
}

export async function updateTrip(tripId, userId, input) {
  const current = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!current) throw AppError.notFound('Trip not found', { code: 'TRIP_NOT_FOUND' })

  const before = serializeTrip(current, userId)
  const changes = Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => value !== undefined && before[key] !== value)
      .map(([key, value]) => [key, { from: before[key], to: value }]),
  )

  const trip = await prisma.$transaction(async (tx) => {
    const updated = await tx.trip.update({ where: { id: tripId }, data: toData(input), include: memberInclude })
    // Shortening the trip deletes the days past the new end (and their stops).
    if (changes.startDate || changes.endDate) await syncDays(tx, updated)
    if (Object.keys(changes).length) {
      await logTripActivity(tx, { tripId, userId, action: ACTIONS.TRIP_UPDATED, details: { fields: Object.keys(changes), changes } })
    }
    return updated
  })
  return serializeTrip(trip, userId)
}

export async function updateBudget(tripId, userId, budgetMinor) {
  const trip = await prisma.$transaction(async (tx) => {
    const current = await tx.trip.findUnique({ where: { id: tripId } })
    const updated = await tx.trip.update({ where: { id: tripId }, data: { budgetMinor: BigInt(budgetMinor) }, include: memberInclude })
    if (Number(current.budgetMinor) !== budgetMinor) {
      await logTripActivity(tx, {
        tripId,
        userId,
        action: ACTIONS.BUDGET_UPDATED,
        details: { from: Number(current.budgetMinor), to: budgetMinor, currency: updated.currency },
      })
    }
    return updated
  })
  return serializeTrip(trip, userId)
}

export async function deleteTrip(tripId) {
  await prisma.trip.delete({ where: { id: tripId } })
}

/** The leader removes a member, or a member leaves. The leader can't leave their own trip. */
export async function removeMember({ tripId, targetUserId, actor }) {
  const isSelf = targetUserId === actor.userId
  if (!isSelf && actor.role !== 'LEADER') throw AppError.forbidden('Only the team leader can remove members.', { code: 'LEADER_ONLY' })

  const target = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId, userId: targetUserId } } })
  if (!target) throw AppError.notFound('Member not found', { code: 'MEMBER_NOT_FOUND' })
  if (target.role === 'LEADER') {
    throw AppError.badRequest('The team leader can’t leave the trip. Delete it instead.', { code: 'LEADER_CANNOT_LEAVE' })
  }
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } })
  await prisma.$transaction(async (tx) => {
    await tx.tripMember.delete({ where: { tripId_userId: { tripId, userId: targetUserId } } })
    await logTripActivity(tx, {
      tripId,
      userId: actor.userId,
      action: isSelf ? ACTIONS.MEMBER_LEFT : ACTIONS.MEMBER_REMOVED,
      details: isSelf ? {} : { memberId: targetUserId, memberName: targetUser?.name },
    })
  })
}
