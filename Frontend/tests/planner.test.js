import { describe, expect, it } from 'vitest'
import { autoPlan, findOverlaps, retimeItems } from '../src/utils/planner'
import { timeToMinutes } from '../src/utils/dates'

// Jaipur: two sights in the old city and one near Amber Fort, ~11 km away.
const place = (id, lat, lng, extra = {}) => ({ id, lat, lng, category: 'sight', durationMinutes: 60, createdAt: `2026-01-01T00:00:0${id.length}Z`, ...extra })
const hawaMahal = place('hawa', 26.9239, 75.8267)
const cityPalace = place('palace', 26.9258, 75.8237)
const amberFort = place('amber', 26.9855, 75.8513)
const byId = Object.fromEntries([hawaMahal, cityPalace, amberFort].map((p) => [p.id, p]))

describe('retiming a day', () => {
  it('chains stops with travel time, but never moves a locked stop', () => {
    const items = [
      { id: '1', placeId: 'hawa', startTime: '09:00', durationMinutes: 60 },
      { id: '2', placeId: 'amber', startTime: '09:00', durationMinutes: 60 },
      { id: '3', placeId: 'palace', startTime: '16:00', durationMinutes: 60, isLocked: true },
    ]
    const [first, second, third] = retimeItems(items, byId, '09:00')
    expect(first.startTime).toBe('09:00')
    expect(timeToMinutes(second.startTime)).toBeGreaterThan(timeToMinutes('10:00')) // 10:00 plus the drive out
    expect(third.startTime).toBe('16:00')
  })

  it('flags stops that start before the previous one ends', () => {
    const overlaps = findOverlaps([
      { id: '1', startTime: '09:00', durationMinutes: 90 },
      { id: '2', startTime: '10:00', durationMinutes: 30 },
      { id: '3', startTime: '11:00', durationMinutes: 30 },
    ])
    expect([...overlaps]).toEqual(['2'])
  })
})

describe('auto-plan (example trips)', () => {
  const days = [{ id: 'd1' }, { id: 'd2' }]

  it('schedules every plannable place once, within the day', () => {
    const drafts = autoPlan({ days, items: [], places: [hawaMahal, cityPalace, amberFort], scores: {} })
    expect(drafts.map((d) => d.placeId).sort()).toEqual(['amber', 'hawa', 'palace'])
    for (const d of drafts) expect(timeToMinutes(d.startTime) + d.durationMinutes).toBeLessThanOrEqual(timeToMinutes('20:30'))
  })

  it('skips downvoted places, hotels and places already on the itinerary', () => {
    const hotel = place('hotel', 26.92, 75.82, { category: 'stay' })
    const drafts = autoPlan({
      days,
      items: [{ dayId: 'd1', placeId: 'hawa', startTime: '09:00', durationMinutes: 60, position: 0 }],
      places: [hawaMahal, cityPalace, amberFort, hotel],
      scores: { amber: -1 },
    })
    expect(drafts.map((d) => d.placeId)).toEqual(['palace'])
  })

  it('stops filling a day once it is full', () => {
    const allDay = Array.from({ length: 6 }, (_, i) => place(`p${i}`, 26.92 + i / 1000, 75.82, { durationMinutes: 180 }))
    const drafts = autoPlan({ days: [{ id: 'd1' }], items: [], places: allDay, scores: {} })
    expect(drafts.length).toBeLessThan(allDay.length)
  })
})
