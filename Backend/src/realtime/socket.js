// Socket.IO server for live trip collaboration.
//
//   connect      auth: { token } — the same short-lived access JWT the REST API uses
//   trip:join    { tripId } → ack { ok, onlineUserIds } | { ok: false, code, message }
//   trip:leave   { tripId }
//
// Server → client: trip:changed, trip:presence, trip:deleted, trip:access-revoked.
// Rooms: `trip:<id>` per trip, `user:<id>` per account (all of a user's tabs).

import { Server } from 'socket.io'
import { z } from 'zod'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { prisma } from '../config/prisma.js'
import { verifyAccessToken } from '../modules/auth/tokens.js'
import { setIo, tripRoom, userRoom } from './io.js'

const MAX_TRIP_ROOMS_PER_SOCKET = 10
const joinSchema = z.object({ tripId: z.uuid() })

const socketError = (code, message) => Object.assign(new Error(message), { data: { code, message } })

/** Rejects the handshake unless it carries a valid access token for an existing account. */
async function authenticate(socket, next) {
  const token = socket.handshake.auth?.token
  if (typeof token !== 'string' || !token) return next(socketError('AUTH_REQUIRED', 'Authentication required'))
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch (error) {
    const expired = error.name === 'TokenExpiredError'
    return next(socketError(expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN', expired ? 'Session expired' : 'Invalid token'))
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true } })
    if (!user) return next(socketError('INVALID_TOKEN', 'Invalid token'))
    socket.data.user = user
    next()
  } catch (error) {
    logger.error({ err: error }, 'socket auth failed')
    next(socketError('SERVER_ERROR', 'Could not verify session'))
  }
}

/** Distinct user ids with at least one socket in the trip room (works across instances with the Redis adapter). */
async function onlineUserIds(io, tripId) {
  const sockets = await io.in(tripRoom(tripId)).fetchSockets()
  return [...new Set(sockets.map((s) => s.data.user?.id).filter(Boolean))]
}

async function broadcastPresence(io, tripId) {
  try {
    io.to(tripRoom(tripId)).emit('trip:presence', { tripId, onlineUserIds: await onlineUserIds(io, tripId) })
  } catch (error) {
    logger.warn({ err: error, tripId }, 'presence broadcast failed')
  }
}

const tripIdOf = (room) => (room.startsWith('trip:') ? room.slice(5) : null)

/** Optional Redis adapter so several API instances share rooms. Falls back to in-memory if Redis is unreachable. */
async function attachRedisAdapter(io) {
  if (!env.REDIS_URL || env.isTest) return
  const [{ Redis }, { createAdapter }] = await Promise.all([import('ioredis'), import('@socket.io/redis-adapter')])
  const options = { lazyConnect: true, maxRetriesPerRequest: 2, connectTimeout: 3000 }
  const pub = new Redis(env.REDIS_URL, options)
  const sub = pub.duplicate()
  try {
    await Promise.all([pub.connect(), sub.connect()])
  } catch (error) {
    pub.disconnect()
    sub.disconnect()
    logger.warn({ err: error.message }, 'Redis unavailable — realtime runs in single-instance mode')
    return
  }
  for (const client of [pub, sub]) client.on('error', (error) => logger.warn({ err: error.message }, 'Redis adapter error'))
  io.adapter(createAdapter(pub, sub))
  logger.info('Socket.IO using the Redis adapter')
}

export async function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    serveClient: false,
    maxHttpBufferSize: 10_000, // clients only send tiny join/leave messages
  })
  await attachRedisAdapter(io)

  io.use(authenticate)

  io.on('connection', (socket) => {
    const user = socket.data.user
    socket.join(userRoom(user.id))

    socket.on('trip:join', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {}
      const parsed = joinSchema.safeParse(payload)
      if (!parsed.success) return reply({ ok: false, code: 'VALIDATION_ERROR', message: 'Invalid trip id' })
      const { tripId } = parsed.data
      const joined = [...socket.rooms].filter((r) => r.startsWith('trip:'))
      if (!joined.includes(tripRoom(tripId)) && joined.length >= MAX_TRIP_ROOMS_PER_SOCKET) {
        return reply({ ok: false, code: 'TOO_MANY_ROOMS', message: 'Too many open trips on one connection' })
      }
      try {
        // Same rule as the REST API: only members may see a trip's live updates.
        const membership = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId, userId: user.id } } })
        if (!membership) return reply({ ok: false, code: 'NOT_A_MEMBER', message: 'You’re not a member of this trip.' })
        await socket.join(tripRoom(tripId))
        reply({ ok: true, onlineUserIds: await onlineUserIds(io, tripId) })
        await broadcastPresence(io, tripId)
      } catch (error) {
        logger.error({ err: error, tripId }, 'trip:join failed')
        reply({ ok: false, code: 'SERVER_ERROR', message: 'Could not join the trip room' })
      }
    })

    socket.on('trip:leave', async (payload) => {
      const parsed = joinSchema.safeParse(payload)
      if (!parsed.success || !socket.rooms.has(tripRoom(parsed.data.tripId))) return
      await socket.leave(tripRoom(parsed.data.tripId))
    })
  })

  // Fires for every way a socket leaves a trip room — trip:leave, disconnect, or
  // being removed server-side (member removed / trip deleted) — so presence stays exact.
  io.of('/').adapter.on('leave-room', (room) => {
    const tripId = tripIdOf(room)
    if (tripId) setImmediate(() => broadcastPresence(io, tripId))
  })

  setIo(io)
  return io
}
