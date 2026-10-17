import { useMemo } from 'react'
import { placesApi, votingApi } from '../../api/endpoints'
import { useTripzyStore } from '../../store/useTripzyStore'
import { ApiError } from '../../api/client'
import { mutate, syncItinerary, syncPlaces } from '../trips/remoteData'

const API_FIELDS = ['name', 'address', 'lat', 'lng', 'category', 'notes', 'durationMinutes']
const pickApiFields = (data) => Object.fromEntries(API_FIELDS.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]))

/**
 * Place and vote actions for one trip. Trips saved on the server go through
 * the API first (which enforces roles, locks and logs the activity) and then
 * reload; example trips stay local.
 * Every action is async and rejects with an ApiError the caller can show.
 */
export function usePlaceActions(trip) {
  const tripId = trip?.id
  const remote = Boolean(trip?.remote)

  return useMemo(() => {
    const store = useTripzyStore.getState
    const reloadPlaces = () => syncPlaces(tripId)

    return {
      async addPlace(data) {
        if (!remote) return store().addPlace(tripId, data)
        const { place } = await mutate(() => placesApi.create(tripId, pickApiFields(data)), reloadPlaces)
        return place.id
      },

      async updatePlace(placeId, patch) {
        if (!remote) return store().updatePlace(placeId, patch)
        await mutate(() => placesApi.update(tripId, placeId, pickApiFields(patch)), reloadPlaces)
      },

      async deletePlace(placeId) {
        if (!remote) return store().deletePlace(placeId)
        // Deleting a place also removes its itinerary stops on the server.
        await mutate(() => placesApi.remove(tripId, placeId), reloadPlaces, () => syncItinerary(tripId))
      },

      async setLock(placeId, locked) {
        if (!remote) return store().setPlaceLock(placeId, locked)
        await mutate(() => placesApi.setLock(tripId, placeId, locked), reloadPlaces)
      },

      /** Clicking your current vote again removes it. */
      async vote(placeId, value) {
        if (!remote) {
          const result = store().castVote(placeId, value)
          if (result.error) throw new ApiError(409, { message: result.error })
          return
        }
        const { votes, currentUserId } = store()
        const mine = votes.find((v) => v.placeId === placeId && v.userId === currentUserId)
        await mutate(() => (mine?.value === value ? placesApi.unvote(tripId, placeId) : placesApi.vote(tripId, placeId, value)), reloadPlaces)
      },

      /** Leader only: ends voting and locks every place with a positive score. */
      async closeVoting() {
        if (!remote) return store().closeVoting(tripId)
        const { lockedCount } = await mutate(() => votingApi.close(tripId), reloadPlaces)
        store().setVotingDeadline(tripId, new Date().toISOString())
        return lockedCount
      },

      async reopenVoting() {
        if (!remote) return store().reopenVoting(tripId)
        await votingApi.reopen(tripId)
        store().setVotingDeadline(tripId, null)
      },
    }
  }, [tripId, remote])
}
