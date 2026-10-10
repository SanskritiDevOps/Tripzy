import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'

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
  const trip = await prisma.trip.create({
    data: {
      ...toData(input),
      ownerId: userId,
      members: { create: { userId, role: 'LEADER' } },
    },
    include: memberInclude,
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
  const trip = await prisma.trip.update({ where: { id: tripId }, data: toData(input), include: memberInclude })
  return serializeTrip(trip, userId)
}

export async function updateBudget(tripId, userId, budgetMinor) {
  const trip = await prisma.trip.update({ where: { id: tripId }, data: { budgetMinor: BigInt(budgetMinor) }, include: memberInclude })
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
  await prisma.tripMember.delete({ where: { tripId_userId: { tripId, userId: targetUserId } } })
}
