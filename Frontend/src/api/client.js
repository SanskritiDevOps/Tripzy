// Thin fetch wrapper for the Tripzy API.
// - Adds the in-memory access token as `Authorization: Bearer …`
// - Sends cookies (the httpOnly refresh token lives in one)
// - Sends this tab's Socket.IO id (X-Socket-Id) so live updates skip the tab that made the change
// - On a 401 it refreshes the session once and retries; if that fails the
//   registered handler clears auth state and sends the user to /login.

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
// The API's own address, for slow requests (AI planning) that must not go through the
// frontend host's proxy, which gives up after ~30 s. Same server as the live-updates socket.
// Falls back to BASE_URL (e.g. local dev, where the Vite proxy has no such limit).
const DIRECT_ORIGIN = import.meta.env.VITE_API_DIRECT_URL || import.meta.env.VITE_SOCKET_URL || ''
const DIRECT_BASE_URL = DIRECT_ORIGIN ? `${DIRECT_ORIGIN.replace(/\/$/, '')}/api` : BASE_URL

export class ApiError extends Error {
  constructor(status, { message, code, details } = {}) {
    super(message || 'Request failed')
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isNetworkError() {
    return this.status === 0
  }
}

// The free backend sleeps when idle and takes ~30–60 s to wake. Meanwhile the proxy
// answers 502/503/504 with an error page (not Tripzy JSON). Safe requests wait and retry.
const WAKE_STATUSES = new Set([502, 503, 504])
const WAKE_DELAYS_MS = [2000, 4000, 8000, 15000, 20000] // ~49 s in total
const WAKING_MESSAGE = 'Tripzy’s server is waking up (this can take up to a minute). Please try again in a moment.'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const hooks = {
  getAccessToken: () => null,
  onWaking: () => {},
  refreshSession: async () => false,
  onUnauthorized: () => {},
  getSocketId: () => null,
}

/** Wired up once by the auth store (avoids an import cycle). */
export function configureApi(overrides) {
  Object.assign(hooks, overrides)
}

/** A proxy error page while the backend wakes up, as opposed to a real answer from the API. */
const isWakeUpError = (error) => error instanceof ApiError && WAKE_STATUSES.has(error.status) && !error.code

/**
 * Sends a request; while the backend is waking up, GETs (and requests marked
 * `retryOnWake`, e.g. login and session refresh) are retried for up to ~50 s.
 */
async function send(path, { retryOnWake, ...options }) {
  const retry = retryOnWake ?? (options.method ?? 'GET') === 'GET'
  for (let attempt = 0; ; attempt++) {
    try {
      return await sendOnce(path, options)
    } catch (error) {
      if (!isWakeUpError(error)) throw error
      if (!retry || attempt >= WAKE_DELAYS_MS.length || options.signal?.aborted) {
        throw new ApiError(error.status, { message: WAKING_MESSAGE, code: 'SERVER_WAKING' })
      }
      hooks.onWaking()
      await sleep(WAKE_DELAYS_MS[attempt])
    }
  }
}

async function sendOnce(path, { method = 'GET', body, token, signal, headers: extraHeaders, direct = false }) {
  const headers = { Accept: 'application/json', ...extraHeaders }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  // Lets the server skip echoing this tab's own changes back over the socket.
  const socketId = hooks.getSocketId()
  if (socketId) headers['X-Socket-Id'] = socketId

  let response
  try {
    response = await fetch(`${direct ? DIRECT_BASE_URL : BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, { message: 'Can’t reach the Tripzy server. Check your connection and try again.', code: 'NETWORK_ERROR' })
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = response.status === 204 ? null : isJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    throw new ApiError(response.status, data ?? { message: `Request failed (${response.status})` })
  }
  return data
}

/**
 * request('/trips', { method: 'POST', body })
 * Pass `auth: false` for endpoints that must not trigger refresh/redirect (login, register…).
 */
export async function request(path, { auth = true, ...options } = {}) {
  try {
    return await send(path, { ...options, token: auth ? hooks.getAccessToken() : null })
  } catch (error) {
    if (!auth || !(error instanceof ApiError) || error.status !== 401) throw error

    const refreshed = await hooks.refreshSession()
    if (refreshed) {
      try {
        return await send(path, { ...options, token: hooks.getAccessToken() })
      } catch (retryError) {
        if (retryError.status !== 401) throw retryError
      }
    }
    hooks.onUnauthorized(error)
    throw error
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
