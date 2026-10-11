// Loads a saved (server) trip's shared data into the local store.
// Every member reads the same rows, so this is what makes changes visible to all.

import { expensesApi, itineraryApi, packingApi, placesApi, tripsApi } from '../../api/endpoints'
import { useTripzyStore } from '../../store/useTripzyStore'

const store = () => useTripzyStore.getState()

/** Trip details, budget and members for every trip the user belongs to. */
export async function syncTrips() {
  const { trips } = await tripsApi.list()
  store().syncRemoteTrips(trips)
}

export async function syncPlaces(tripId) {
  const { places } = await placesApi.list(tripId)
  store().syncRemotePlaces(tripId, places)
}

export async function syncItinerary(tripId) {
  const { days } = await itineraryApi.get(tripId)
  store().syncRemoteItinerary(tripId, days)
}

export async function syncExpenses(tripId) {
  store().syncRemoteExpenses(tripId, await expensesApi.list(tripId))
}

export async function syncPacking(tripId) {
  const { items } = await packingApi.list(tripId)
  store().syncRemotePacking(tripId, items)
}

/** Places first (stops reference them), then the rest in parallel. */
export async function syncTripData(tripId) {
  await syncPlaces(tripId)
  await Promise.all([syncItinerary(tripId), syncExpenses(tripId), syncPacking(tripId)])
}

/**
 * Runs a server change, then reloads the affected data so the screen shows
 * exactly what the server stored. If the change fails, the data is reloaded
 * anyway (undoing any optimistic update) and the error is re-thrown.
 */
export async function mutate(request, ...resyncs) {
  try {
    return await request()
  } finally {
    await Promise.all(resyncs.map((resync) => resync().catch(() => {})))
  }
}
