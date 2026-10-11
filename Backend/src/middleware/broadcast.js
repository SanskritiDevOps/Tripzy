import { emitTripChanged } from '../realtime/io.js'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SOCKET_ID = /^[\w-]{1,64}$/

/** The `X-Socket-Id` the client sends so its own tab isn't told about its own change. */
export function originSocketId(req) {
  const id = req.get('x-socket-id')
  return id && SOCKET_ID.test(id) ? id : undefined
}

/**
 * After a successful write to a trip, tells the other connected members which
 * parts of the trip changed. Runs on `finish`, i.e. after the response (and
 * so the database transaction) has completed — clients never re-fetch stale data.
 * Mount after requireTripAccess.
 */
export function broadcastTripChange(...scopes) {
  return (req, res, next) => {
    if (READ_METHODS.has(req.method)) return next()
    const tripId = req.valid?.params?.tripId ?? req.params.tripId
    res.on('finish', () => {
      // Handlers that don't change trip data (e.g. AI drafts) set res.locals.skipBroadcast.
      if (res.statusCode >= 400 || res.locals.skipBroadcast) return
      emitTripChanged(tripId, {
        scopes,
        actor: { id: req.user.id, name: req.user.name },
        exceptSocketId: originSocketId(req),
      })
    })
    next()
  }
}
