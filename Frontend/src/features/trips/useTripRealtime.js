import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { realtime, useRealtimeStatus } from '../../realtime/socket'
import { useTripzyStore } from '../../store/useTripzyStore'
import { useActivityStore } from '../../store/useActivityStore'
import { toast } from '../../store/useToastStore'
import { syncExpenses, syncItinerary, syncPacking, syncPlaces, syncTripData, syncTrips } from './remoteData'

const BATCH_MS = 150
const ignore = () => {}

/** Re-fetches only what changed. Places load before the itinerary (stops reference them). */
async function resync(tripId, scopes) {
  const tasks = []
  if (scopes.has('trip')) tasks.push(syncTrips().catch(ignore))
  if (scopes.has('places')) tasks.push(syncPlaces(tripId).then(() => scopes.has('itinerary') && syncItinerary(tripId)).catch(ignore))
  else if (scopes.has('itinerary')) tasks.push(syncItinerary(tripId).catch(ignore))
  if (scopes.has('expenses')) tasks.push(syncExpenses(tripId).catch(ignore))
  if (scopes.has('packing')) tasks.push(syncPacking(tripId).catch(ignore))
  await Promise.all(tasks)
  // Every change is logged, so the activity feed always has something new.
  useActivityStore.getState().refresh(tripId)
}

/**
 * Collects scopes from bursts of events (e.g. a drag-and-drop reorder or
 * several quick ticks) into one re-fetch, and never runs two at once.
 */
function createResyncQueue(tripId) {
  let pending = new Set()
  let timer = null
  let chain = Promise.resolve()
  return {
    add(scopes) {
      scopes.forEach((scope) => pending.add(scope))
      clearTimeout(timer)
      timer = setTimeout(() => {
        const batch = pending
        pending = new Set()
        chain = chain.then(() => resync(tripId, batch))
      }, BATCH_MS)
    },
    cancel() {
      clearTimeout(timer)
      pending = new Set()
    },
  }
}

/**
 * Joins a server trip's live room while its workspace is open:
 * - other members' changes are re-fetched as they happen
 * - presence (who has the trip open) replaces the simulated online dots
 * - if the trip is deleted or you're removed, you're sent back to My trips
 * After a dropped connection everything is re-fetched, so nothing is missed.
 *
 * Returns { live } — true while updates are flowing. Demo trips are never live.
 */
export function useTripRealtime(trip) {
  const tripId = trip?.remote ? trip.id : null
  const navigate = useNavigate()
  const status = useRealtimeStatus((s) => s.status)
  const [joinedTripId, setJoinedTripId] = useState(null)

  useEffect(() => {
    if (!tripId) return
    realtime.connect()
    const socket = realtime.socket
    const queue = createResyncQueue(tripId)
    const { setPresence, deleteTrip } = useTripzyStore.getState()
    const isMe = (actor) => actor?.id === useTripzyStore.getState().currentUserId
    let joinedBefore = false
    let active = true

    const join = () => {
      socket.timeout(5000).emit('trip:join', { tripId }, (error, reply) => {
        if (!active) return
        if (error || !reply?.ok) {
          setJoinedTripId(null)
          // Lost access while offline: the trips sync drops it and the page shows why.
          if (reply?.code === 'NOT_A_MEMBER') syncTrips().catch(ignore)
          return
        }
        setPresence(tripId, reply.onlineUserIds)
        setJoinedTripId(tripId)
        // Reconnected after a drop: catch up on anything missed while offline.
        if (joinedBefore) {
          syncTrips().catch(ignore)
          syncTripData(tripId).catch(ignore)
          useActivityStore.getState().refresh(tripId)
        }
        joinedBefore = true
      })
    }

    const leaveWorkspace = (message) => {
      queue.cancel()
      if (message) toast.info(message)
      deleteTrip(tripId) // local copy only — the server change already happened
      navigate('/trips', { replace: true })
    }

    const onChanged = (event) => event.tripId === tripId && queue.add(event.scopes ?? [])
    const onPresence = (event) => event.tripId === tripId && setPresence(tripId, event.onlineUserIds)
    const onDeleted = (event) => {
      if (event.tripId !== tripId) return
      leaveWorkspace(isMe(event.actor) ? null : `${event.actor?.name ?? 'The team leader'} deleted this trip.`)
    }
    const onRevoked = (event) => {
      if (event.tripId !== tripId) return
      if (event.reason === 'left') leaveWorkspace(isMe(event.actor) ? null : 'You left this trip in another tab.')
      else leaveWorkspace(`${event.actor?.name ?? 'The team leader'} removed you from this trip.`)
    }

    socket.on('connect', join)
    socket.on('trip:changed', onChanged)
    socket.on('trip:presence', onPresence)
    socket.on('trip:deleted', onDeleted)
    socket.on('trip:access-revoked', onRevoked)
    if (socket.connected) join()

    return () => {
      active = false
      queue.cancel()
      socket.off('connect', join)
      socket.off('trip:changed', onChanged)
      socket.off('trip:presence', onPresence)
      socket.off('trip:deleted', onDeleted)
      socket.off('trip:access-revoked', onRevoked)
      if (socket.connected) socket.emit('trip:leave', { tripId })
      setPresence(tripId, [])
      setJoinedTripId(null)
    }
  }, [tripId, navigate])

  return { live: Boolean(tripId) && status === 'connected' && joinedTripId === tripId }
}

/** Calls `callback` when another member changes one of `scopes` on this trip (e.g. to reload a list a component owns). */
export function useTripChanges(tripId, scopes, callback) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })
  const key = scopes.join(',')
  useEffect(() => {
    const socket = realtime.socket
    if (!tripId || !socket) return
    const wanted = key.split(',')
    const handler = (event) => {
      if (event.tripId === tripId && event.scopes?.some((s) => wanted.includes(s))) latest.current()
    }
    socket.on('trip:changed', handler)
    return () => socket.off('trip:changed', handler)
  }, [tripId, key])
}
