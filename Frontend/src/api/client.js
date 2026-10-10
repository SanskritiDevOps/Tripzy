// Thin fetch wrapper for the Tripzy API.
// - Adds the in-memory access token as `Authorization: Bearer …`
// - Sends cookies (the httpOnly refresh token lives in one)
// - On a 401 it refreshes the session once and retries; if that fails the
//   registered handler clears auth state and sends the user to /login.

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

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

const hooks = {
  getAccessToken: () => null,
  refreshSession: async () => false,
  onUnauthorized: () => {},
}

/** Wired up once by the auth store (avoids an import cycle). */
export function configureApi(overrides) {
  Object.assign(hooks, overrides)
}

async function send(path, { method = 'GET', body, token, signal }) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
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
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
