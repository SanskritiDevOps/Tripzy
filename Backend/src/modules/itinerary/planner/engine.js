// Code-side itinerary planning: the code does the math, the AI does the judgment.
//
// - scheduleDay: turns an ordered list of places into start times, respecting the
//   day window, pace, travel time and stops that must not move (locked / kept).
// - codePlan:    deterministic plan — clusters places into days by distance and
//                orders them by nearest neighbour. Used as the AI's grouping hint
//                and as the fallback when the AI is unavailable or keeps failing.
// - checkAiPlan: validates the AI's JSON (known places, no duplicates, known days)
//                and repairs times; returns errors the AI can correct on retry.

import { centroid, distanceKm, nearestNeighborOrder, travelMinutes } from './geo.js'

const PACES = {
  relaxed: { label: 'relaxed', bufferMinutes: 30, activityShare: 0.65 },
  balanced: { label: 'balanced', bufferMinutes: 15, activityShare: 0.8 },
  packed: { label: 'packed', bufferMinutes: 5, activityShare: 1 },
}

export const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
export const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * Settings shared by all planners:
 * window { start, end } in minutes · bufferMinutes · capMinutes (max activity time per day)
 */
export function planSettings({ dayStart, dayEnd, pace }) {
  const window = { start: toMinutes(dayStart), end: toMinutes(dayEnd) }
  const config = PACES[pace]
  return { window, pace, bufferMinutes: config.bufferMinutes, capMinutes: Math.round((window.end - window.start) * config.activityShare) }
}

/**
 * Places `sequence` (in order) into a day around its fixed stops.
 * Each entry may carry `preferredStart` (minutes) — used as the earliest start,
 * so deliberate gaps (e.g. waiting for lunch) are kept.
 * Returns { placed: [{ place, start }], overflow: [place] }.
 */
export function scheduleDay(day, sequence, settings) {
  const { window, bufferMinutes, capMinutes } = settings
  const fixed = [...day.fixed].sort((a, b) => a.start - b.start)
  const placed = []
  const overflow = []
  let busy = fixed.reduce((sum, f) => sum + f.durationMinutes, 0)
  let cursor = window.start

  for (const { place, preferredStart } of sequence) {
    const duration = place.durationMinutes
    if (busy + duration > capMinutes) {
      overflow.push(place)
      continue
    }
    let start = Math.max(cursor, preferredStart ?? window.start)
    for (let guard = 0; guard < 100; guard++) {
      // Leave time to get here from wherever we were last.
      const stops = [...fixed, ...placed.map((p) => ({ place: p.place, start: p.start, end: p.start + p.place.durationMinutes }))]
      const before = stops.filter((s) => s.end <= start).sort((a, b) => b.end - a.end)[0]
      if (before) start = Math.max(start, before.end + travelMinutes(before.place, place) + bufferMinutes)
      start = Math.ceil(start / 5) * 5 // tidy 5-minute start times
      // Don't collide with a fixed stop (including travel to/from it).
      const clash = fixed.find((f) => start < f.end + travelMinutes(f.place, place) && f.start < start + duration + travelMinutes(place, f.place))
      if (!clash) break
      start = Math.max(start + 1, clash.end)
    }
    if (start + duration > window.end) {
      overflow.push(place)
      continue
    }
    placed.push({ place, start })
    cursor = start + duration
    busy += duration
  }
  return { placed, overflow }
}

const byPriority = (a, b) => b.score - a.score || a.createdAt - b.createdAt

/**
 * Deterministic plan. Returns
 * { days: [{ dayId, stops: [{ placeId, start, tip }] }], unplaced: [{ placeId, reason }], groups: { dayNumber: [place] } }
 */
export function codePlan(days, candidates, settings) {
  const room = Math.min(settings.capMinutes, settings.window.end - settings.window.start)
  const buckets = days.map((day) => ({
    day,
    anchors: day.fixed.map((f) => f.place),
    assigned: [],
    load: day.fixed.reduce((sum, f) => sum + f.durationMinutes, 0),
  }))
  const unplaced = []

  for (const place of [...candidates].sort(byPriority)) {
    const need = place.durationMinutes + 20 + settings.bufferMinutes
    let best = null
    let bestCost = Infinity
    for (const bucket of buckets) {
      if (bucket.load + need > room) continue
      const center = centroid([...bucket.anchors, ...bucket.assigned])
      const cost = (center ? distanceKm(center, place) : 4) + bucket.load / 180
      if (cost < bestCost) {
        bestCost = cost
        best = bucket
      }
    }
    if (!best) {
      unplaced.push({ placeId: place.id, reason: 'Not enough time left on the selected days.' })
      continue
    }
    best.assigned.push(place)
    best.load += need
  }

  const planned = buckets.map((bucket) => {
    const start = bucket.anchors[0] ?? bucket.assigned[0]
    const ordered = bucket.assigned.length ? nearestNeighborOrder(bucket.assigned, start) : []
    const { placed, overflow } = scheduleDay(bucket.day, ordered.map((place) => ({ place })), settings)
    overflow.forEach((place) => unplaced.push({ placeId: place.id, reason: 'Didn’t fit in the day with travel time.' }))
    return { dayId: bucket.day.id, stops: placed.map(({ place, start }) => ({ placeId: place.id, start, tip: '' })) }
  })
  const groups = Object.fromEntries(buckets.map((b) => [b.day.dayNumber, b.assigned]))
  return { days: planned, unplaced, groups }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const cleanTip = (tip) => (typeof tip === 'string' ? tip.replace(/\s+/g, ' ').trim().slice(0, 200) : '')

/**
 * Checks the AI's answer against the inputs and repairs start times.
 * `refs` maps "P1"… to candidate places. Returns { errors, plan } where plan has
 * the same shape as codePlan's result. Invalid entries are dropped and stops that
 * don't fit become "unplaced", so the repaired plan is always safe to save.
 */
export function checkAiPlan(output, { days, refs, settings, codePlacedCount }) {
  const errors = []
  const dayByNumber = new Map(days.map((d) => [d.dayNumber, d]))
  const refOf = new Map([...refs].map(([ref, place]) => [place.id, ref]))
  const seen = new Set()
  const sequences = new Map(days.map((d) => [d.id, []]))

  for (const aiDay of output.days ?? []) {
    const day = dayByNumber.get(aiDay.dayNumber)
    if (!day) {
      errors.push(`Day ${aiDay.dayNumber} is not one of the days to plan (${[...dayByNumber.keys()].join(', ')}).`)
      continue
    }
    for (const item of aiDay.items ?? []) {
      const place = refs.get(String(item.placeRef).trim())
      if (!place) {
        errors.push(`Unknown placeRef "${item.placeRef}" — use only refs from PLACES.`)
        continue
      }
      if (seen.has(place.id)) {
        errors.push(`${refOf.get(place.id)} (${place.name}) is scheduled more than once.`)
        continue
      }
      if (!TIME.test(String(item.startTime))) {
        errors.push(`${refOf.get(place.id)} has an invalid startTime "${item.startTime}" — use HH:MM (24h).`)
        continue
      }
      seen.add(place.id)
      sequences.get(day.id).push({ place, preferredStart: toMinutes(item.startTime), tip: cleanTip(item.tip) })
    }
  }

  const planned = []
  const unplaced = []
  let placedCount = 0
  for (const day of days) {
    const sequence = sequences.get(day.id).sort((a, b) => a.preferredStart - b.preferredStart)
    const { placed, overflow } = scheduleDay(day, sequence, settings)
    for (const place of overflow) {
      unplaced.push({ placeId: place.id, reason: 'Didn’t fit in the day with travel time.' })
      errors.push(
        `Day ${day.dayNumber}: ${refOf.get(place.id)} (${place.name}, ${place.durationMinutes} min) doesn’t fit — with travel time and the ${settings.pace} pace it would run past ${toTime(settings.window.end)} or over the day’s activity limit. Move it to a day with room or list it in "unplaced".`,
      )
    }
    const tips = new Map(sequence.map((s) => [s.place.id, s.tip]))
    planned.push({ dayId: day.id, stops: placed.map(({ place, start }) => ({ placeId: place.id, start, tip: tips.get(place.id) ?? '' })) })
    placedCount += placed.length
  }

  const aiReasons = new Map((output.unplaced ?? []).map((u) => [refs.get(String(u.placeRef).trim())?.id, cleanTip(u.reason)]))
  const missing = []
  for (const [ref, place] of refs) {
    if (seen.has(place.id)) continue
    const reason = aiReasons.get(place.id)
    if (reason === undefined) missing.push(`${ref} (${place.name})`)
    unplaced.push({ placeId: place.id, reason: reason || 'The AI left this place out.' })
  }
  // The AI may leave places out only when they genuinely don't fit.
  const enough = placedCount >= codePlacedCount - Math.max(1, Math.floor(codePlacedCount * 0.2))
  if (!enough) {
    errors.push(`Only ${placedCount} places were scheduled, but ${codePlacedCount} fit in the available time. Schedule more of: ${missing.join(', ') || 'the unplaced places'}.`)
  }
  // `usable`: the repaired plan is good enough to show even if the AI didn't fix every error.
  return { errors, usable: enough, plan: { days: planned, unplaced } }
}
