// Dates are "YYYY-MM-DD" strings and times "HH:MM" strings, as in the API.
// Helpers work in local time.

const MS_PER_DAY = 86_400_000

function parseDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayIso() {
  return toIsoDate(new Date())
}

export function addDays(isoDate, days) {
  const date = parseDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Whole days from a to b (b − a). */
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / MS_PER_DAY)
}

export function tripLength(startDate, endDate) {
  return daysBetween(startDate, endDate) + 1
}

export function formatDate(isoDate, options = { day: 'numeric', month: 'short' }) {
  return parseDate(isoDate).toLocaleDateString('en-IN', options)
}

export function formatDateRange(start, end) {
  const s = parseDate(start)
  const e = parseDate(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  const sameMonth = sameYear && s.getMonth() === e.getMonth()
  if (sameMonth) {
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
  }
  const startFmt = s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  return `${startFmt} – ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function weekday(isoDate) {
  return parseDate(isoDate).toLocaleDateString('en-IN', { weekday: 'short' })
}

/** Trip status relative to today. */
export function tripStatus(startDate, endDate, today = todayIso()) {
  if (daysBetween(today, startDate) > 0) return { kind: 'upcoming', days: daysBetween(today, startDate) }
  if (daysBetween(endDate, today) > 0) return { kind: 'past', days: daysBetween(endDate, today) }
  return { kind: 'ongoing', day: daysBetween(startDate, today) + 1 }
}

export function countdownLabel(startDate, endDate) {
  const status = tripStatus(startDate, endDate)
  if (status.kind === 'upcoming') return status.days === 1 ? 'Starts tomorrow' : `${status.days} days to go`
  if (status.kind === 'ongoing') return `Day ${status.day} · happening now`
  return 'Trip completed'
}

export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes) {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

/** "14:30" → "2:30 PM" */
export function formatTime(time) {
  const minutes = timeToMinutes(time)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** 150 → "2h 30m" */
export function formatDuration(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  return h ? `${h}h` : `${m}m`
}

export function relativeTime(isoDateTime) {
  const diff = Date.now() - new Date(isoDateTime).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoDateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Feed-style timestamps: "just now", "5 minutes ago", "3 hours ago",
 * "Yesterday at 3:15 PM", "Monday at 9:00 AM", "12 Oct at 6:30 PM".
 */
export function relativeTimeLong(isoDateTime, now = new Date()) {
  const date = new Date(isoDateTime)
  const minutes = Math.floor((now - date) / 60000)
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const days = daysBetween(toIsoDate(date), toIsoDate(now))
  if (days === 0) {
    const hours = Math.floor(minutes / 60)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  if (days === 1) return `Yesterday at ${time}`
  if (days < 7) return `${date.toLocaleDateString('en-IN', { weekday: 'long' })} at ${time}`
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) })} at ${time}`
}

/** Section heading for a day in a feed: "Today", "Yesterday", "Monday, 12 Oct". */
export function dayHeading(isoDateTime, now = new Date()) {
  const date = new Date(isoDateTime)
  const days = daysBetween(toIsoDate(date), toIsoDate(now))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) })
}
