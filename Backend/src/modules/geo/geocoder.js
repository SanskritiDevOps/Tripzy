// Place search and destination geocoding with OpenStreetMap Nominatim.
//
// Follows the public Nominatim usage policy (operations.osmfoundation.org/policies/nominatim):
// - at most 1 request per second, from this one server (requests are spaced in a queue)
// - an identifying User-Agent/Referer
// - results cached, and identical in-flight queries shared
// - no search-as-you-type: the client only searches on an explicit submit
// Point GEOCODER_URL at your own Nominatim (or a compatible provider) for heavier use.

import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'
import { distanceKm } from '../itinerary/planner/geo.js'

const MIN_INTERVAL_MS = 1100
const MAX_QUEUE_WAIT_MS = 10_000
const TIMEOUT_MS = 8000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 1000
const NEAR_RADIUS_DEG = 0.75 // ~80 km box around the trip centre

export const ATTRIBUTION = '© OpenStreetMap contributors'
export const isGeocoderEnabled = () => Boolean(env.GEOCODER_URL)

// ── Cache + queue ───────────────────────────────────────────────
const cache = new Map() // key → { value, expires }
const inflight = new Map() // key → Promise
let nextSlotAt = 0

function cached(key) {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (hit.expires < Date.now()) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value) // oldest first
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
}

/** Waits for the next free 1-request-per-second slot; refuses if the queue is too long. */
async function takeSlot() {
  const now = Date.now()
  const wait = Math.max(0, nextSlotAt - now)
  if (wait > MAX_QUEUE_WAIT_MS) throw busy()
  nextSlotAt = Math.max(now, nextSlotAt) + MIN_INTERVAL_MS
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
}

const busy = () => new AppError(503, 'Map search is busy — try again in a few seconds.', { code: 'GEOCODER_BUSY' })
const unavailable = () => new AppError(503, 'Map search is unavailable right now. You can still drop a pin on the map.', { code: 'GEOCODER_UNAVAILABLE' })

async function nominatim(params) {
  if (!isGeocoderEnabled()) throw new AppError(503, 'Map search isn’t set up on this server.', { code: 'GEOCODER_DISABLED' })
  const query = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', 'accept-language': 'en', ...params })
  if (env.GEOCODER_EMAIL) query.set('email', env.GEOCODER_EMAIL)
  const key = query.toString()

  const hit = cached(key)
  if (hit !== undefined) return hit
  if (inflight.has(key)) return inflight.get(key)

  const request = (async () => {
    await takeSlot()
    let response
    try {
      response = await fetch(`${env.GEOCODER_URL}/search?${key}`, {
        headers: { 'User-Agent': `Tripzy/1.0 (+${env.appUrl})`, Referer: env.appUrl, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw unavailable()
    }
    if (response.status === 429) throw busy()
    if (!response.ok) throw unavailable()
    const body = await response.json().catch(() => null)
    if (!Array.isArray(body)) throw unavailable()
    remember(key, body)
    return body
  })().finally(() => inflight.delete(key))

  inflight.set(key, request)
  return request
}

// ── Mapping OSM results to Tripzy places ────────────────────────
const FOOD = new Set(['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'ice_cream', 'biergarten', 'bakery', 'confectionery'])
const STAY = new Set(['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet', 'camp_site', 'resort'])
const SIGHT_TOURISM = new Set(['attraction', 'museum', 'viewpoint', 'artwork', 'gallery', 'zoo', 'theme_park', 'aquarium', 'monument'])
const TRANSIT = new Set(['station', 'halt', 'bus_station', 'aerodrome', 'terminal', 'ferry_terminal', 'bus_stop', 'tram_stop', 'subway_entrance'])

export function categoryOf({ category, type }) {
  if (category === 'amenity' && FOOD.has(type)) return 'food'
  if (category === 'shop' && FOOD.has(type)) return 'food'
  if (category === 'tourism' && STAY.has(type)) return 'stay'
  if (category === 'leisure' && type === 'resort') return 'stay'
  if (['aeroway', 'railway', 'public_transport'].includes(category) || TRANSIT.has(type)) return 'transit'
  if (category === 'tourism' && SIGHT_TOURISM.has(type)) return 'sight'
  if (['historic', 'natural', 'waterway'].includes(category)) return 'sight'
  // Named villages, valleys, islands, towers, bridges… are things people go to see.
  if (category === 'place') return 'sight'
  if (category === 'man_made' && ['tower', 'lighthouse', 'bridge', 'obelisk', 'observatory', 'pier', 'windmill'].includes(type)) return 'sight'
  if (category === 'amenity' && ['place_of_worship', 'theatre', 'arts_centre', 'fountain'].includes(type)) return 'sight'
  if (category === 'leisure' || category === 'shop' || category === 'sport') return 'activity'
  if (category === 'tourism') return 'sight'
  return 'other'
}

const DEFAULT_MINUTES = { sight: 90, food: 60, activity: 120, stay: 30, transit: 45, other: 60 }

export function toPlace(result) {
  const parts = String(result.display_name ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  const name = (result.name || parts[0] || 'Unnamed place').slice(0, 120)
  const address = parts.filter((p) => p !== name).slice(0, 4).join(', ').slice(0, 300)
  const category = categoryOf(result)
  return {
    osmId: `${String(result.osm_type ?? 'x')[0]}${result.osm_id ?? result.place_id}`,
    name,
    address,
    lat: Number(result.lat),
    lng: Number(result.lon),
    category,
    durationMinutes: DEFAULT_MINUTES[category],
  }
}

const viewbox = ({ lat, lng }) =>
  [lng - NEAR_RADIUS_DEG, lat + NEAR_RADIUS_DEG, lng + NEAR_RADIUS_DEG, lat - NEAR_RADIUS_DEG].map((n) => n.toFixed(4)).join(',')

/**
 * Searches places, preferring ones near `near` ({ lat, lng }). Falls back to a
 * worldwide search when nothing is found nearby. Returns up to `limit` places.
 */
export async function searchPlaces(query, { near, limit = 8 } = {}) {
  const q = query.trim()
  let results = []
  if (near) results = await nominatim({ q, limit: String(limit), viewbox: viewbox(near), bounded: '1' })
  if (results.length === 0) results = await nominatim({ q, limit: String(limit) })
  const places = results.map(toPlace).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  // OSM often has a place twice (a point and an outline): keep one per name within ~300 m.
  const unique = []
  for (const place of places) {
    const twin = unique.some((u) => u.osmId === place.osmId || (u.name.toLowerCase() === place.name.toLowerCase() && distanceKm(u, place) < 0.3))
    if (!twin) unique.push(place)
  }
  // Keep the map's relevance order, but put results far from the trip last, so
  // "cafe" in Manali lists cafés in town before one 40 km away.
  const LOCAL_KM = 15
  if (near) unique.sort((a, b) => Number(distanceKm(near, a) > LOCAL_KM) - Number(distanceKm(near, b) > LOCAL_KM))
  return unique
}

/** Map centre for a trip destination ("Manali, Himachal Pradesh"), or null if not found / unavailable. */
export async function geocodeDestination(destination) {
  if (!isGeocoderEnabled() || !destination?.trim()) return null
  try {
    const [top] = await nominatim({ q: destination.trim(), limit: '1' })
    return top ? { lat: Number(top.lat), lng: Number(top.lon) } : null
  } catch {
    return null // never block saving a trip on the map service
  }
}

/** Test helper: forget cached results and queue timing. */
export function resetGeocoder() {
  cache.clear()
  inflight.clear()
  nextSlotAt = 0
}
