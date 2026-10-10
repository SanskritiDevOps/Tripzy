import { useMemo } from 'react'
import { placesApi } from '../../api/endpoints'
import { useTripzyStore } from '../../store/useTripzyStore'

const API_FIELDS = ['name', 'address', 'lat', 'lng', 'category', 'notes', 'durationMinutes']
const pickApiFields = (data) => Object.fromEntries(API_FIELDS.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]))

/**
 * Place mutations for one trip. Trips saved on the server go through the API
 * first (which enforces roles and locks); bundled demo trips stay local.
 * Every action is async and rejects with an ApiError the caller can show.
 */
export function usePlaceActions(trip) {
  const tripId = trip?.id
  const remote = Boolean(trip?.remote)

  return useMemo(() => {
    const store = useTripzyStore.getState
    return {
      async addPlace(data) {
        if (!remote) return store().addPlace(tripId, data)
        const { place } = await placesApi.create(tripId, pickApiFields(data))
        return store().addPlace(tripId, place)
      },

      async updatePlace(placeId, patch) {
        if (remote) {
          const { place } = await placesApi.update(tripId, placeId, pickApiFields(patch))
          store().updatePlace(placeId, place)
        } else {
          store().updatePlace(placeId, patch)
        }
      },

      async deletePlace(placeId) {
        if (remote) await placesApi.remove(tripId, placeId)
        store().deletePlace(placeId)
      },

      async setLock(placeId, locked) {
        if (remote) await placesApi.setLock(tripId, placeId, locked)
        store().setPlaceLock(placeId, locked)
      },

      /** Closing the vote locks every place with a positive score. */
      async closeVoting(winnerIds) {
        if (remote) await Promise.all(winnerIds.map((id) => placesApi.setLock(tripId, id, true)))
        store().closeVoting(tripId)
      },
    }
  }, [tripId, remote])
}
