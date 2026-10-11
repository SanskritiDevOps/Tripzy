import { useCallback, useRef, useState } from 'react'
import { DESTINATIONS } from '../../data/destinations'
import { searchPlaces } from '../../data/poiCatalog'
import { centroid } from '../../utils/geo'
import { geoApi } from '../../api/endpoints'

/**
 * Where a trip's map should centre: its places, else the geocoded destination
 * (saved trips), else a built-in destination. Null when nothing is known yet.
 */
export function tripCenter(trip, places) {
  const fromPlaces = centroid(places)
  if (fromPlaces) return fromPlaces
  if (trip.destinationLat != null && trip.destinationLng != null) return { lat: trip.destinationLat, lng: trip.destinationLng }
  const dest = DESTINATIONS.find((d) => d.id === trip.destinationId)
  return dest ? { lat: dest.lat, lng: dest.lng } : null
}

const notOnBoard = (places) => {
  const existing = new Set(places.map((p) => p.name.toLowerCase()))
  return (p) => !existing.has(p.name.toLowerCase())
}

/**
 * Instant suggestions from the built-in catalogue — only for its handful of
 * destinations; everything else comes from the map search.
 */
export function quickSuggestions(trip, places, query) {
  if (!trip.destinationId) return []
  return searchPlaces(trip.destinationId, query).filter(notOnBoard(places))
}

/**
 * OpenStreetMap search for a trip. Nominatim's usage policy forbids
 * search-as-you-type, so this runs only when `search(query)` is called
 * (Enter or the "Search the map" button).
 *
 * resultsFor(query) → results for exactly that query (empty if it's stale).
 */
export function useMapSearch(trip, places) {
  const [state, setState] = useState({ query: '', status: 'idle', results: [], error: '' })
  const controller = useRef(null)

  const search = useCallback(
    async (rawQuery) => {
      const query = rawQuery.trim()
      if (query.length < 2) return
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      setState({ query, status: 'loading', results: [], error: '' })
      try {
        const { results } = await geoApi.search(query, tripCenter(trip, places), { signal: abort.signal })
        const fresh = results.filter(notOnBoard(places))
        setState({ query, status: fresh.length ? 'done' : 'done-empty', results: fresh, error: '' })
      } catch (error) {
        if (error.name === 'AbortError') return
        setState({ query, status: 'error', results: [], error: error.status === 401 ? '' : error.message })
      }
    },
    [trip, places],
  )

  const resultsFor = (query) => (state.query === query.trim() ? state.results : [])
  const statusFor = (query) => (state.query === query.trim() ? state.status : 'idle')
  return { search, resultsFor, statusFor, error: state.error }
}
