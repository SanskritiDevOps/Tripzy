// Deterministic, code-only itinerary planning (used for example trips):
// cluster places into days by distance, order by nearest neighbour, then chain times.

import { estimateTravelMinutes, centroid, distanceKm, nearestNeighborOrder } from './geo'
import { minutesToTime, timeToMinutes } from './dates'

const DAY_START = '09:00'
const DAY_END = '20:30'
const PLANNABLE = new Set(['sight', 'food', 'activity', 'other'])

/**
 * Recomputes start times for an ordered list of items in one day.
 * Locked items keep their time; others start after the previous stop plus travel time.
 */
export function retimeItems(orderedItems, placesById, firstStart = DAY_START) {
  let cursor = timeToMinutes(firstStart)
  let previousPlace = null
  return orderedItems.map((item) => {
    const place = placesById[item.placeId]
    if (previousPlace && place) cursor += estimateTravelMinutes(previousPlace, place)
    const start = item.isLocked ? timeToMinutes(item.startTime) : cursor
    cursor = start + item.durationMinutes
    previousPlace = place ?? previousPlace
    return { ...item, startTime: minutesToTime(start) }
  })
}

/** Flags stops that start before the previous one ends (incl. travel). */
export function findOverlaps(orderedItems) {
  const overlaps = new Set()
  for (let i = 1; i < orderedItems.length; i++) {
    const prev = orderedItems[i - 1]
    const prevEnd = timeToMinutes(prev.startTime) + prev.durationMinutes
    if (timeToMinutes(orderedItems[i].startTime) < prevEnd) overlaps.add(orderedItems[i].id)
  }
  return overlaps
}

/**
 * Fills unscheduled, non-downvoted places into the trip's days.
 * Existing items are never moved; new stops are appended to the day whose
 * stops are closest, as long as the day still has room.
 * Returns an array of new item drafts: { dayId, placeId, startTime, durationMinutes }.
 */
export function autoPlan({ days, items, places, scores }) {
  const placesById = Object.fromEntries(places.map((p) => [p.id, p]))
  const scheduled = new Set(items.map((i) => i.placeId))
  const windowMinutes = timeToMinutes(DAY_END) - timeToMinutes(DAY_START)

  const candidates = places
    .filter((p) => !scheduled.has(p.id) && PLANNABLE.has(p.category) && (scores[p.id] ?? 0) >= 0)
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || a.createdAt.localeCompare(b.createdAt))

  const buckets = days.map((day) => {
    const dayItems = items.filter((i) => i.dayId === day.id).sort((a, b) => a.position - b.position)
    const points = dayItems.map((i) => placesById[i.placeId]).filter(Boolean)
    const last = dayItems.at(-1)
    const lastEnd = last ? timeToMinutes(last.startTime) + last.durationMinutes : timeToMinutes(DAY_START)
    const used = lastEnd - timeToMinutes(DAY_START)
    return { day, points, lastPlace: points.at(-1) ?? null, lastEnd, used, added: [] }
  })

  for (const place of candidates) {
    const needed = place.durationMinutes + 30
    let best = null
    let bestCost = Infinity
    for (const bucket of buckets) {
      if (bucket.used + needed > windowMinutes) continue
      const allPoints = [...bucket.points, ...bucket.added]
      const center = centroid(allPoints)
      const distance = center ? distanceKm(center, place) : 4
      const cost = distance + bucket.used / 180
      if (cost < bestCost) {
        bestCost = cost
        best = bucket
      }
    }
    if (!best) continue
    best.added.push(place)
    best.used += needed
  }

  const drafts = []
  for (const bucket of buckets) {
    if (!bucket.added.length) continue
    const ordered = nearestNeighborOrder(bucket.added, bucket.lastPlace ?? bucket.added[0])
    let cursor = bucket.lastEnd
    let previous = bucket.lastPlace
    for (const place of ordered) {
      if (previous) cursor += estimateTravelMinutes(previous, place)
      drafts.push({
        dayId: bucket.day.id,
        placeId: place.id,
        startTime: minutesToTime(cursor),
        durationMinutes: place.durationMinutes,
      })
      cursor += place.durationMinutes
      previous = place
    }
  }
  return drafts
}

/** Suggested start time for appending `place` to the end of a day. */
export function nextSlot(dayItems, placesById, place) {
  const last = dayItems.at(-1)
  if (!last) return DAY_START
  const lastPlace = placesById[last.placeId]
  const travel = lastPlace && place ? estimateTravelMinutes(lastPlace, place) : 15
  return minutesToTime(timeToMinutes(last.startTime) + last.durationMinutes + travel)
}
