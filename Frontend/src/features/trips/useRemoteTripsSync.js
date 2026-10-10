import { useEffect, useState } from 'react'
import { tripsApi } from '../../api/endpoints'
import { useTripzyStore } from '../../store/useTripzyStore'
import { useAuthStore } from '../../store/useAuthStore'

/**
 * Pulls the user's server-side trips (GET /api/trips) into the local store.
 * Returns { syncing, error } so pages can wait before declaring a trip missing.
 */
export function useRemoteTripsSync() {
  const userId = useAuthStore((s) => s.user?.id)
  const syncRemoteTrips = useTripzyStore((s) => s.syncRemoteTrips)
  const [state, setState] = useState({ syncing: true, error: null })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    tripsApi
      .list()
      .then(({ trips }) => {
        if (cancelled) return
        syncRemoteTrips(trips)
        setState({ syncing: false, error: null })
      })
      .catch((error) => {
        // 401s are handled globally (redirect to login); keep other failures non-fatal.
        if (!cancelled) setState({ syncing: false, error: error.status === 401 ? null : error.message })
      })
    return () => {
      cancelled = true
    }
  }, [userId, syncRemoteTrips])

  return state
}
