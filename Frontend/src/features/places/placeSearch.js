import { DESTINATIONS } from '../../data/destinations'
import { searchPlaces } from '../../data/poiCatalog'
import { centroid } from '../../utils/geo'

export function tripCenter(trip, places) {
  const fromPlaces = centroid(places)
  if (fromPlaces) return fromPlaces
  const dest = DESTINATIONS.find((d) => d.id === trip.destinationId)
  return dest ? { lat: dest.lat, lng: dest.lng } : { lat: 20.5937, lng: 78.9629 }
}

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}

/**
 * A place typed by hand has no geocoding result in the demo, so it is pinned
 * near the trip centre with a small deterministic offset.
 */
export function customPlaceDraft(name, category, trip, places) {
  const center = tripCenter(trip, places)
  const h = hash(name.toLowerCase())
  const dLat = (((h & 0xff) / 255) - 0.5) * 0.04
  const dLng = ((((h >> 8) & 0xff) / 255) - 0.5) * 0.04
  return {
    name: name.trim(),
    address: trip.destination,
    lat: center.lat + dLat,
    lng: center.lng + dLng,
    category,
    durationMinutes: category === 'food' ? 60 : 90,
  }
}

/** Geocoding results for a trip, excluding places already on its board. */
export function searchNewPlaces(trip, places, query) {
  const existing = new Set(places.map((p) => p.name.toLowerCase()))
  return searchPlaces(trip.destinationId, query).filter((p) => !existing.has(p.name.toLowerCase()))
}
