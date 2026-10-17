import { useEffect, useState } from 'react'
import { syncTripData } from './remoteData'
import { toast } from '../../store/useToastStore'

/**
 * Loads a server trip's places, votes, itinerary, expenses and packing list
 * when its workspace opens. Returns { loading } — example trips are never loading.
 */
export function useRemoteTripData(trip) {
  const tripId = trip?.remote ? trip.id : null
  const [loadedFor, setLoadedFor] = useState(null)

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    syncTripData(tripId)
      .catch((error) => {
        if (!cancelled && error.status !== 401) toast.error(`Couldn’t load the latest trip data: ${error.message}`)
      })
      .finally(() => {
        if (!cancelled) setLoadedFor(tripId)
      })
    return () => {
      cancelled = true
    }
  }, [tripId])

  return { loading: Boolean(tripId) && loadedFor !== tripId }
}
