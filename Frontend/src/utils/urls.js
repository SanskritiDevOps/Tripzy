/** Link that opens the "New trip" modal on /trips with the given fields prefilled. */
export function buildNewTripUrl({ destination, start, end, group }) {
  const params = new URLSearchParams({ new: '1' })
  if (destination) params.set('destination', destination)
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  if (group) params.set('group', group)
  return `/trips?${params}`
}
