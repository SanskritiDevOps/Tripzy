import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'
import { ACTIONS, logTripActivity } from '../activities/activities.service.js'

const STOP_LOCKED_MESSAGE = 'This stop is locked by the team leader and cannot be modified.'
const DAY_MS = 86_400_000

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function serializeItem(item) {
  return {
    id: item.id,
    dayId: item.dayId,
    placeId: item.placeId,
    position: item.position,
    startTime: item.startTime,
    durationMinutes: item.durationMinutes,
    isLocked: item.isLocked,
    source: item.source,
    notes: item.notes,
    costMinor: item.costMinor,
    version: item.version,
    createdById: item.createdById,
    updatedAt: item.updatedAt.toISOString(),
  }
}

/**
 * Makes the trip's day rows match its start/end dates: dates are re-aligned,
 * missing days are created and days past the end are deleted (with their stops).
 * Call inside the transaction that changes the dates.
 */
export async function syncDays(db, trip) {
  const count = Math.round((trip.endDate - trip.startDate) / DAY_MS) + 1
  const existing = await db.itineraryDay.findMany({ where: { tripId: trip.id } })
  const byNumber = new Map(existing.map((d) => [d.dayNumber, d]))

  for (let n = 1; n <= count; n++) {
    const date = new Date(trip.startDate.getTime() + (n - 1) * DAY_MS)
    const day = byNumber.get(n)
    // Upsert: two members opening a new trip at once can't create the same day twice.
    if (!day) await db.itineraryDay.upsert({ where: { tripId_dayNumber: { tripId: trip.id, dayNumber: n } }, create: { tripId: trip.id, dayNumber: n, date }, update: { date } })
    else if (day.date.getTime() !== date.getTime()) await db.itineraryDay.update({ where: { id: day.id }, data: { date } })
  }
  await db.itineraryDay.deleteMany({ where: { tripId: trip.id, dayNumber: { gt: count } } })
}

/** Rewrites `position` for a day in start-time order. */
async function normalizeDay(db, dayId) {
  const items = await db.itineraryItem.findMany({ where: { dayId } })
  items.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.position - b.position)
  // Sequential: queries inside an interactive transaction must not run in parallel.
  for (const [index, item] of items.entries()) {
    if (item.position !== index) await db.itineraryItem.update({ where: { id: item.id }, data: { position: index } })
  }
}

async function findDay(db, tripId, dayId) {
  const day = await db.itineraryDay.findFirst({ where: { id: dayId, tripId } })
  if (!day) throw AppError.badRequest('That day doesn’t belong to this trip.', { code: 'DAY_NOT_FOUND', details: { dayId: 'Unknown day' } })
  return day
}

async function findPlace(db, tripId, placeId) {
  const place = await db.place.findFirst({ where: { id: placeId, tripId } })
  if (!place) throw AppError.badRequest('That place isn’t on this trip’s board.', { code: 'PLACE_NOT_FOUND', details: { placeId: 'Unknown place' } })
  return place
}

async function findItem(db, tripId, itemId) {
  const item = await db.itineraryItem.findFirst({ where: { id: itemId, day: { tripId } }, include: { day: true, place: true } })
  if (!item) throw AppError.notFound('Stop not found', { code: 'STOP_NOT_FOUND' })
  return item
}

/** Members can't touch a stop whose time slot is locked or whose place is locked. */
const isProtected = (item) => item.isLocked || item.place.isLocked
function assertCanModify(item, role) {
  if (role !== 'LEADER' && isProtected(item)) throw AppError.forbidden(STOP_LOCKED_MESSAGE, { code: 'STOP_LOCKED' })
}

export async function getItinerary(tripId) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) throw AppError.notFound('Trip not found', { code: 'TRIP_NOT_FOUND' })
  // Trips created before the itinerary moved to the server get their days here.
  await syncDays(prisma, trip)
  const days = await prisma.itineraryDay.findMany({
    where: { tripId },
    orderBy: { dayNumber: 'asc' },
    include: { items: { orderBy: { position: 'asc' } } },
  })
  return days.map((d) => ({ id: d.id, dayNumber: d.dayNumber, date: d.date.toISOString().slice(0, 10), items: d.items.map(serializeItem) }))
}

export async function addItem({ tripId, userId, role }, input) {
  if (input.isLocked && role !== 'LEADER') throw AppError.forbidden('Only the team leader can lock a time slot.', { code: 'LEADER_ONLY' })
  const item = await prisma.$transaction(async (tx) => {
    const day = await findDay(tx, tripId, input.dayId)
    const place = await findPlace(tx, tripId, input.placeId)
    const created = await tx.itineraryItem.create({
      data: { ...input, position: 9999, createdById: userId, source: 'MANUAL' },
    })
    await normalizeDay(tx, day.id)
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.STOP_ADDED, details: { itemId: created.id, placeName: place.name, dayNumber: day.dayNumber } })
    return tx.itineraryItem.findUnique({ where: { id: created.id } })
  })
  return serializeItem(item)
}

/**
 * Edits a stop. Send the `version` you last saw: if someone saved the stop in
 * the meantime, the write is rejected with 409 and the current stop is returned
 * so the client can show it.
 */
export async function updateItem({ tripId, userId, role, itemId }, { version, ...input }) {
  const item = await findItem(prisma, tripId, itemId)
  assertCanModify(item, role)
  if (version !== undefined && version !== item.version) {
    throw new AppError(409, 'Someone else just edited this stop. Review their changes and try again.', {
      code: 'VERSION_CONFLICT',
      details: { current: serializeItem(item) },
    })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const day = input.dayId ? await findDay(tx, tripId, input.dayId) : item.day
    const place = input.placeId ? await findPlace(tx, tripId, input.placeId) : item.place
    // Conditional on the version we checked, so two simultaneous saves can't both win.
    const { count } = await tx.itineraryItem.updateMany({
      where: { id: itemId, version: item.version },
      data: { ...input, version: { increment: 1 } },
    })
    if (count === 0) throw new AppError(409, 'Someone else just edited this stop. Review their changes and try again.', { code: 'VERSION_CONFLICT' })
    await normalizeDay(tx, day.id)
    if (day.id !== item.dayId) await normalizeDay(tx, item.dayId)
    await logTripActivity(tx, {
      tripId,
      userId,
      action: ACTIONS.STOP_UPDATED,
      details: { itemId, placeName: place.name, dayNumber: day.dayNumber, fields: Object.keys(input) },
    })
    return tx.itineraryItem.findUnique({ where: { id: itemId } })
  })
  return serializeItem(updated)
}

export async function deleteItem({ tripId, userId, role, itemId }) {
  const item = await findItem(prisma, tripId, itemId)
  assertCanModify(item, role)
  await prisma.$transaction(async (tx) => {
    await tx.itineraryItem.delete({ where: { id: itemId } })
    await normalizeDay(tx, item.dayId)
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.STOP_DELETED, details: { itemId, placeName: item.place.name, dayNumber: item.day.dayNumber } })
  })
}

/** Leader only (enforced by the route). */
export async function setItemLock({ tripId, userId, itemId }, locked) {
  const item = await findItem(prisma, tripId, itemId)
  if (item.isLocked === locked) return serializeItem(item)
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.itineraryItem.update({ where: { id: itemId }, data: { isLocked: locked, version: { increment: 1 } } })
    await logTripActivity(tx, {
      tripId,
      userId,
      action: locked ? ACTIONS.STOP_LOCKED : ACTIONS.STOP_UNLOCKED,
      details: { itemId, placeName: item.place.name, dayNumber: item.day.dayNumber },
    })
    return result
  })
  return serializeItem(updated)
}

/**
 * Applies a new order (and re-flowed start times) for one day. The list must
 * contain exactly that day's stops. Members can't change the time of a
 * protected stop.
 */
export async function reorderDay({ tripId, userId, role, dayId }, orderedItems) {
  const day = await findDay(prisma, tripId, dayId)
  const current = await prisma.itineraryItem.findMany({ where: { dayId }, include: { place: true } })
  const byId = new Map(current.map((i) => [i.id, i]))
  const ids = orderedItems.map((i) => i.id)
  if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id))) {
    throw AppError.badRequest('The new order must list every stop of the day exactly once.', { code: 'INVALID_ORDER' })
  }
  if (role !== 'LEADER') {
    for (const { id, startTime } of orderedItems) {
      const item = byId.get(id)
      if (isProtected(item) && item.startTime !== startTime) throw AppError.forbidden(STOP_LOCKED_MESSAGE, { code: 'STOP_LOCKED' })
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const [position, { id, startTime }] of orderedItems.entries()) {
      await tx.itineraryItem.update({ where: { id }, data: { position, startTime, version: { increment: 1 } } })
    }
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.ITINERARY_REORDERED, details: { dayNumber: day.dayNumber } })
  })
  return (await prisma.itineraryItem.findMany({ where: { dayId }, orderBy: { position: 'asc' } })).map(serializeItem)
}

/**
 * Saves a generated plan, from the AI or the code-only planner.
 * With `replaceDayIds` (or the single `replaceDayId`), those days' unprotected
 * stops are cleared first ("Regenerate"); locked stops and stops of locked
 * places are always kept. Each new stop gets source AI and the AI's tip as notes.
 */
export async function applyPlan({ tripId, userId }, { items, replaceDayId, replaceDayIds = [], engine = 'code' }) {
  const replacing = [...new Set([...replaceDayIds, ...(replaceDayId ? [replaceDayId] : [])])]
  return prisma.$transaction(async (tx) => {
    const replacedDays = []
    for (const dayId of replacing) {
      replacedDays.push(await findDay(tx, tripId, dayId))
      await tx.itineraryItem.deleteMany({ where: { dayId, isLocked: false, place: { isLocked: false } } })
    }
    const touched = new Set(replacing)
    for (const draft of items) {
      await findDay(tx, tripId, draft.dayId)
      await findPlace(tx, tripId, draft.placeId)
      await tx.itineraryItem.create({ data: { ...draft, position: 9999, source: 'AI', createdById: userId } })
      touched.add(draft.dayId)
    }
    for (const dayId of touched) await normalizeDay(tx, dayId)
    await logTripActivity(tx, {
      tripId,
      userId,
      action: ACTIONS.ITINERARY_GENERATED,
      details: {
        count: items.length,
        engine,
        ...(replacedDays.length === 1 ? { dayNumber: replacedDays[0].dayNumber } : {}),
        ...(replacedDays.length > 1 ? { dayCount: replacedDays.length } : {}),
      },
    })
    return { added: items.length }
  })
}
