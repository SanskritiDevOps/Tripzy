const EARTH_RADIUS_KM = 6371

export function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Rough city travel time: ~22 km/h average plus 5 min to get going. */
export function estimateTravelMinutes(a, b) {
  const km = distanceKm(a, b)
  if (km < 0.3) return 5
  return Math.round(5 + (km / 22) * 60)
}

/** Orders points by repeatedly visiting the nearest unvisited one. */
export function nearestNeighborOrder(points, start = points[0]) {
  if (points.length <= 1) return [...points]
  const remaining = [...points]
  const ordered = []
  let current = start ?? remaining[0]
  while (remaining.length) {
    let bestIndex = 0
    let bestDistance = Infinity
    remaining.forEach((p, i) => {
      const d = distanceKm(current, p)
      if (d < bestDistance) {
        bestDistance = d
        bestIndex = i
      }
    })
    current = remaining.splice(bestIndex, 1)[0]
    ordered.push(current)
  }
  return ordered
}

export function centroid(points) {
  if (points.length === 0) return null
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 })
  return { lat: sum.lat / points.length, lng: sum.lng / points.length }
}
