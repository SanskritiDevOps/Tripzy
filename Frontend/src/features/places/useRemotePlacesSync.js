import { useEffect } from 'react'
import { placesApi } from '../../api/endpoints'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'

/** Loads a server trip's places (with lock state) into the local store when the workspace opens. */
export function useRemotePlacesSync(trip) {
  const syncRemotePlaces = useTripzyStore((s) => s.syncRemotePlaces)
  const tripId = trip?.remote ? trip.id : null

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    placesApi
      .list(tripId)
      .then(({ places }) => !cancelled && syncRemotePlaces(tripId, places))
      .catch((error) => {
        if (!cancelled && error.status !== 401) toast.error(`Couldn’t load places: ${error.message}`)
      })
    return () => {
      cancelled = true
    }
  }, [tripId, syncRemotePlaces])
}
