// Holds the Socket.IO server and the helpers the REST layer uses to notify
// trip rooms. Every helper is a no-op until the server is attached, so the
// Express app (and the HTTP tests) work with or without realtime.

let io = null

export const tripRoom = (tripId) => `trip:${tripId}`
export const userRoom = (userId) => `user:${userId}`

export function setIo(server) {
  io = server
}

/**
 * Tells everyone in the trip room that some of its data changed. Clients
 * re-fetch only the listed scopes ('trip' | 'places' | 'itinerary' |
 * 'expenses' | 'packing' | 'invites'); the activity feed always refreshes.
 * `exceptSocketId` skips the tab that made the change — it already has it.
 */
export function emitTripChanged(tripId, { scopes, actor, exceptSocketId } = {}) {
  if (!io) return
  let target = io.to(tripRoom(tripId))
  if (exceptSocketId) target = target.except(exceptSocketId)
  target.emit('trip:changed', { tripId, scopes, actor, at: new Date().toISOString() })
}

/** The trip is gone: tell its room, then empty the room. */
export function emitTripDeleted(tripId, actor) {
  if (!io) return
  io.to(tripRoom(tripId)).emit('trip:deleted', { tripId, actor })
  io.in(tripRoom(tripId)).socketsLeave(tripRoom(tripId))
}

/** A member left or was removed: drop all their sockets from the room and tell them why. */
export function revokeTripAccess(tripId, userId, { reason, actor }) {
  if (!io) return
  io.to(userRoom(userId)).emit('trip:access-revoked', { tripId, reason, actor })
  io.in(userRoom(userId)).socketsLeave(tripRoom(tripId))
}
