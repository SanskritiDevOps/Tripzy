// Session state. The access token is kept in memory only (never localStorage),
// so an XSS bug can't read a long-lived credential. Reloads restore the session
// through the httpOnly refresh-token cookie via POST /auth/refresh.

import { create } from 'zustand'
import { ApiError, configureApi } from '../api/client'
import { authApi } from '../api/endpoints'
import { useTripzyStore } from './useTripzyStore'

let refreshInFlight = null

export const useAuthStore = create((set, get) => {
  function setSession({ user, accessToken }) {
    set({ user, accessToken, status: 'authenticated' })
    useTripzyStore.getState().attachSessionUser(user)
  }

  function clearSession() {
    set({ user: null, accessToken: null, status: 'anonymous' })
    useTripzyStore.getState().detachSessionUser()
  }

  async function refreshOnce() {
    try {
      setSession(await authApi.refresh())
      return true
    } catch (error) {
      // Another tab rotated the token a moment ago; the browser now holds the new cookie.
      if (error instanceof ApiError && error.code === 'REFRESH_RACE') {
        await new Promise((resolve) => setTimeout(resolve, 300))
        try {
          setSession(await authApi.refresh())
          return true
        } catch {
          /* fall through to signed-out */
        }
      }
      if (error instanceof ApiError && error.isNetworkError && get().status === 'unknown') {
        // Server unreachable on first load: treat as signed out but keep the reason.
        set({ bootError: error.message })
      }
      clearSession()
      return false
    }
  }

  return {
    status: 'unknown', // 'unknown' → checking, then 'authenticated' | 'anonymous'
    user: null,
    accessToken: null,
    bootError: null,

    /** Single-flight: concurrent callers share one refresh request (rotation must not run twice). */
    refreshSession() {
      refreshInFlight ??= refreshOnce().finally(() => {
        refreshInFlight = null
      })
      return refreshInFlight
    },

    async bootstrap() {
      if (get().status !== 'unknown') return
      await get().refreshSession()
    },

    async login(credentials) {
      const session = await authApi.login(credentials)
      setSession(session)
      return session.user
    },

    async register(details) {
      const session = await authApi.register(details)
      setSession(session)
      return session.user
    },

    async logout() {
      try {
        await authApi.logout()
      } finally {
        clearSession()
      }
    },

    clearSession,
  }
})

configureApi({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshSession: () => useAuthStore.getState().refreshSession(),
  // Replaced by AuthBridge once the router is mounted.
  onUnauthorized: () => useAuthStore.getState().clearSession(),
})
