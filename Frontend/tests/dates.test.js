import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDuration, formatTime, minutesToTime, tripLength, tripStatus } from '../src/utils/dates'

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29') // leap year
  })

  it('counts trip days inclusively', () => {
    expect(tripLength('2026-11-14', '2026-11-16')).toBe(3)
    expect(tripLength('2026-11-14', '2026-11-14')).toBe(1)
    expect(daysBetween('2026-03-28', '2026-04-02')).toBe(5) // across a DST change in many zones
  })

  it('knows whether a trip is upcoming, happening or over', () => {
    expect(tripStatus('2026-11-14', '2026-11-16', '2026-11-10')).toEqual({ kind: 'upcoming', days: 4 })
    expect(tripStatus('2026-11-14', '2026-11-16', '2026-11-15')).toEqual({ kind: 'ongoing', day: 2 })
    expect(tripStatus('2026-11-14', '2026-11-16', '2026-11-20')).toEqual({ kind: 'past', days: 4 })
  })
})

describe('times', () => {
  it('formats 24-hour times for display', () => {
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatTime('14:30')).toBe('2:30 PM')
  })

  it('keeps computed times within the same day', () => {
    expect(minutesToTime(9 * 60 + 5)).toBe('09:05')
    expect(minutesToTime(25 * 60)).toBe('23:59')
    expect(minutesToTime(-10)).toBe('00:00')
  })

  it('formats durations', () => {
    expect(formatDuration(150)).toBe('2h 30m')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(45)).toBe('45m')
  })
})
