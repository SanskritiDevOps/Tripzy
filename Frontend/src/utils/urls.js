/** Link that opens the "New trip" modal on /trips with the given fields prefilled. */
export function buildNewTripUrl({ destination, start, end, group }) {
  const params = new URLSearchParams({ new: '1' })
  if (destination) params.set('destination', destination)
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  if (group) params.set('group', group)
  return `/trips?${params}`
}

/** Only same-app paths are allowed as redirect targets (no open redirects). */
export function safeRedirect(target, fallback = '/trips') {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback
  if (target.startsWith('/login') || target.startsWith('/signup')) return fallback
  return target
}

/** /login?redirect=<path> (or /signup?redirect=…). */
export function loginPath(redirectTo, page = '/login') {
  const target = safeRedirect(redirectTo, '')
  return target ? `${page}?redirect=${encodeURIComponent(target)}` : page
}
