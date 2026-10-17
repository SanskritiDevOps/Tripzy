import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'

export const ACTIONS = Object.freeze({
  TRIP_CREATED: 'TRIP_CREATED',
  TRIP_UPDATED: 'TRIP_UPDATED',
  BUDGET_UPDATED: 'BUDGET_UPDATED',
  PLACE_ADDED: 'PLACE_ADDED',
  PLACE_UPDATED: 'PLACE_UPDATED',
  PLACE_DELETED: 'PLACE_DELETED',
  PLACE_LOCKED: 'PLACE_LOCKED',
  PLACE_UNLOCKED: 'PLACE_UNLOCKED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  MEMBER_LEFT: 'MEMBER_LEFT',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  INVITE_SENT: 'INVITE_SENT',
  STOP_ADDED: 'STOP_ADDED',
  STOP_UPDATED: 'STOP_UPDATED',
  STOP_DELETED: 'STOP_DELETED',
  STOP_LOCKED: 'STOP_LOCKED',
  STOP_UNLOCKED: 'STOP_UNLOCKED',
  ITINERARY_REORDERED: 'ITINERARY_REORDERED',
  ITINERARY_GENERATED: 'ITINERARY_GENERATED',
  VOTED: 'VOTED',
  VOTING_CLOSED: 'VOTING_CLOSED',
  VOTING_REOPENED: 'VOTING_REOPENED',
  EXPENSE_ADDED: 'EXPENSE_ADDED',
  EXPENSE_UPDATED: 'EXPENSE_UPDATED',
  EXPENSE_DELETED: 'EXPENSE_DELETED',
  SETTLEMENT_RECORDED: 'SETTLEMENT_RECORDED',
  PACKING_ITEM_ADDED: 'PACKING_ITEM_ADDED',
  PACKING_ITEM_DELETED: 'PACKING_ITEM_DELETED',
  PACKING_ITEM_PACKED: 'PACKING_ITEM_PACKED',
  PACKING_RESET: 'PACKING_RESET',
})

/**
 * Records one activity entry. Pass the transaction client (`tx`) of the change
 * being logged, so the change and its log entry commit or roll back together:
 *
 *   await prisma.$transaction(async (tx) => {
 *     const place = await tx.place.create(…)
 *     await logTripActivity(tx, { tripId, userId, action: ACTIONS.PLACE_ADDED, details: { placeName: place.name } })
 *   })
 */
export function logTripActivity(db, { tripId, userId, action, details = {} }) {
  if (!ACTIONS[action]) throw new Error(`Unknown activity action: ${action}`)
  return db.tripActivity.create({ data: { tripId, userId, action, details } })
}

const FIELD_LABELS = { name: 'name', destination: 'destination', startDate: 'dates', endDate: 'dates', groupType: 'group type', currency: 'currency' }

function formatMoney(minor, currency = 'INR') {
  const value = Number(minor) / 100
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value)
}

/** Plain-text sentence for an entry, e.g. "Priya added Amber Fort". The frontend can render richer markup from `details`. */
function summarize(action, details, actorName = 'Someone') {
  const d = details ?? {}
  switch (action) {
    case ACTIONS.TRIP_CREATED:
      return `${actorName} created the trip`
    case ACTIONS.TRIP_UPDATED: {
      const fields = [...new Set((d.fields ?? []).map((f) => FIELD_LABELS[f] ?? f))]
      return fields.length ? `${actorName} updated the trip ${fields.join(', ')}` : `${actorName} updated the trip`
    }
    case ACTIONS.BUDGET_UPDATED:
      return d.to ? `${actorName} updated the trip budget to ${formatMoney(d.to, d.currency)}` : `${actorName} removed the trip budget`
    case ACTIONS.PLACE_ADDED:
      return `${actorName} added ${d.placeName}`
    case ACTIONS.PLACE_UPDATED:
      return `${actorName} edited ${d.placeName}`
    case ACTIONS.PLACE_DELETED:
      return `${actorName} removed ${d.placeName}`
    case ACTIONS.PLACE_LOCKED:
      return `${actorName} locked ${d.placeName}`
    case ACTIONS.PLACE_UNLOCKED:
      return `${actorName} unlocked ${d.placeName}`
    case ACTIONS.MEMBER_JOINED:
      return `${actorName} joined the trip`
    case ACTIONS.MEMBER_LEFT:
      return `${actorName} left the trip`
    case ACTIONS.MEMBER_REMOVED:
      return `${actorName} removed ${d.memberName ?? 'a member'} from the trip`
    case ACTIONS.INVITE_SENT:
      return `${actorName} invited ${d.email}`
    case ACTIONS.STOP_ADDED:
      return `${actorName} added ${d.placeName} to Day ${d.dayNumber}`
    case ACTIONS.STOP_UPDATED:
      return `${actorName} updated ${d.placeName} on Day ${d.dayNumber}`
    case ACTIONS.STOP_DELETED:
      return `${actorName} removed ${d.placeName} from Day ${d.dayNumber}`
    case ACTIONS.STOP_LOCKED:
      return `${actorName} locked the time slot for ${d.placeName}`
    case ACTIONS.STOP_UNLOCKED:
      return `${actorName} unlocked the time slot for ${d.placeName}`
    case ACTIONS.ITINERARY_REORDERED:
      return `${actorName} reordered Day ${d.dayNumber}`
    case ACTIONS.ITINERARY_GENERATED:
      return `${actorName} ${d.engine === 'gemini' ? 'planned with AI' : 'auto-planned'} ${d.count} ${d.count === 1 ? 'stop' : 'stops'}${
        d.dayNumber ? ` for Day ${d.dayNumber}` : d.dayCount ? ` across ${d.dayCount} days` : ''
      }`
    case ACTIONS.VOTED:
      return `${actorName} ${d.value > 0 ? 'upvoted' : 'downvoted'} ${d.placeName}`
    case ACTIONS.VOTING_CLOSED:
      return `${actorName} closed voting and locked ${d.lockedCount ?? 0} winning ${d.lockedCount === 1 ? 'place' : 'places'}`
    case ACTIONS.VOTING_REOPENED:
      return `${actorName} reopened voting`
    case ACTIONS.EXPENSE_ADDED:
      return `${actorName} added ${d.title} (${formatMoney(d.amountMinor, d.currency)})`
    case ACTIONS.EXPENSE_UPDATED:
      return `${actorName} edited the expense ${d.title}`
    case ACTIONS.EXPENSE_DELETED:
      return `${actorName} deleted the expense ${d.title}`
    case ACTIONS.SETTLEMENT_RECORDED:
      return `${actorName} recorded that ${d.fromName} paid ${d.toName} ${formatMoney(d.amountMinor, d.currency)}`
    case ACTIONS.PACKING_ITEM_ADDED:
      return `${actorName} added ${d.label} to the packing list`
    case ACTIONS.PACKING_ITEM_DELETED:
      return `${actorName} removed ${d.label} from the packing list`
    case ACTIONS.PACKING_ITEM_PACKED:
      return `${actorName} packed ${d.label}`
    case ACTIONS.PACKING_RESET:
      return `${actorName} unchecked the whole packing list`
    default:
      return `${actorName} updated the trip`
  }
}

function serializeActivity(entry) {
  const user = entry.user ? { id: entry.user.id, name: entry.user.name, email: entry.user.email, avatarUrl: entry.user.avatarUrl } : null
  return {
    id: entry.id,
    tripId: entry.tripId,
    action: entry.action,
    details: entry.details,
    message: summarize(entry.action, entry.details, user?.name ?? 'A former member'),
    user,
    createdAt: entry.createdAt.toISOString(),
  }
}

/**
 * Newest first. Cursor pagination: pass the `nextCursor` from the previous page
 * as `before` to get older entries.
 */
export async function listActivities(tripId, { limit = 30, before } = {}) {
  let cursorFilter = {}
  if (before) {
    const cursor = await prisma.tripActivity.findFirst({ where: { id: before, tripId }, select: { createdAt: true, id: true } })
    if (!cursor) throw AppError.badRequest('Invalid cursor', { code: 'INVALID_CURSOR' })
    // (createdAt, id) keeps ordering stable when two entries share a timestamp.
    cursorFilter = {
      OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
    }
  }
  const rows = await prisma.tripActivity.findMany({
    where: { tripId, ...cursorFilter },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  })
  const page = rows.slice(0, limit)
  return {
    activities: page.map(serializeActivity),
    nextCursor: rows.length > limit ? page.at(-1).id : null,
  }
}
