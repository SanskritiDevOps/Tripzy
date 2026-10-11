// One shared Socket.IO connection per tab, open while the user is signed in.
// The handshake carries the in-memory access token; if the server rejects it
// as expired, the session is refreshed once and the connection retried.

import { io } from 'socket.io-client'
import { create } from 'zustand'

const hooks = {
  getAccessToken: () => null,
  refreshSession: async () => false,
}

/** Wired up once by the auth store (avoids an import cycle). */
export function configureRealtime(overrides) {
  Object.assign(hooks, overrides)
}

/** Socket server origin: VITE_SOCKET_URL, else the API's origin when VITE_API_URL is absolute, else this page. */
function serverUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  const api = import.meta.env.VITE_API_URL ?? ''
  return /^https?:\/\//.test(api) ? new URL(api).origin : undefined
}

/** 'offline' (signed out) → 'connecting' → 'connected' ⇄ 'reconnecting' */
export const useRealtimeStatus = create(() => ({ status: 'offline' }))
const setStatus = (status) => useRealtimeStatus.setState({ status })

let socket = null
let refreshedForError = false

function createSocket() {
  const s = io(serverUrl(), {
    autoConnect: false,
    withCredentials: true,
    // Called on every (re)connect, so a refreshed token is always used.
    auth: (cb) => cb({ token: hooks.getAccessToken() }),
  })

  s.on('connect', () => {
    refreshedForError = false
    setStatus('connected')
  })
  s.on('disconnect', (reason) => {
    // 'io client disconnect' = we closed it (sign-out); everything else retries automatically.
    setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting')
  })
  s.io.on('reconnect_attempt', () => setStatus('reconnecting'))
  s.on('connect_error', async (error) => {
    const code = error.data?.code
    if (code !== 'TOKEN_EXPIRED' && code !== 'INVALID_TOKEN' && code !== 'AUTH_REQUIRED') {
      setStatus('reconnecting') // network trouble — the manager keeps retrying
      return
    }
    // Rejected by the auth check: the client won't retry by itself.
    if (refreshedForError) {
      setStatus('offline')
      return
    }
    refreshedForError = true
    if (await hooks.refreshSession()) s.connect()
    else setStatus('offline')
  })
  return s
}

export const realtime = {
  /** Opens the connection (idempotent). Call after sign-in. */
  connect() {
    socket ??= createSocket()
    if (!socket.connected && !socket.active) {
      setStatus('connecting')
      socket.connect()
    }
  },

  /** Closes the connection. Call on sign-out. */
  disconnect() {
    socket?.disconnect()
    setStatus('offline')
  },

  /** The id the API uses to skip notifying this tab about its own changes. */
  get id() {
    return socket?.connected ? socket.id : null
  },

  get socket() {
    return socket
  },
}
