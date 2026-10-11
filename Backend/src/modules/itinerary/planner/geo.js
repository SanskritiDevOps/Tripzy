// Distance and travel-time estimates used by the planner (same model as the frontend's utils/geo.js).

const EARTH_RADIUS_KM = 6371
const toRad = (deg) => (deg * Math.PI) / 180

export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Rough city travel time: ~22 km/h average plus 5 min to get going. */
export function travelMinutes(a, b) {
  if (!a || !b) return 0
  const km = distanceKm(a, b)
  if (km < 0.3) return 5
  return Math.round(5 + (km / 22) * 60)
}

export function centroid(points) {
  if (points.length === 0) return null
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 })
  return { lat: sum.lat / points.length, lng: sum.lng / points.length }
}

/** Orders points by repeatedly visiting the nearest unvisited one. */
export function nearestNeighborOrder(points, start = points[0]) {
  const remaining = [...points]
  const ordered = []
  let current = start
  while (remaining.length) {
    let best = 0
    remaining.forEach((p, i) => {
      if (distanceKm(current, p) < distanceKm(current, remaining[best])) best = i
    })
    current = remaining.splice(best, 1)[0]
    ordered.push(current)
  }
  return ordered
}
