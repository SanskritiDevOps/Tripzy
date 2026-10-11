// Server-side trip activity feeds (GET /api/trips/:id/activities), cached per trip.

import { create } from 'zustand'
import { api } from '../api/client'

const PAGE_SIZE = 30
const EMPTY = { items: [], nextCursor: null, status: 'idle', error: null, loadingMore: false }

const fetchPage = (tripId, before) => {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (before) params.set('before', before)
  return api.get(`/trips/${tripId}/activities?${params}`)
}

export const useActivityStore = create((set, get) => {
  const patch = (tripId, changes) => set((s) => ({ feeds: { ...s.feeds, [tripId]: { ...(s.feeds[tripId] ?? EMPTY), ...changes } } }))

  return {
    feeds: {},

    /** Loads the newest page. Shows a loading state only when nothing is cached yet. */
    async load(tripId) {
      const current = get().feeds[tripId] ?? EMPTY
      patch(tripId, { status: current.items.length ? 'refreshing' : 'loading', error: null })
      try {
        const { activities, nextCursor } = await fetchPage(tripId)
        patch(tripId, { items: activities, nextCursor, status: 'ready' })
      } catch (error) {
        if (error.status === 401) return // handled globally
        patch(tripId, { status: current.items.length ? 'ready' : 'error', error: error.message })
      }
    },

    async loadMore(tripId) {
      const feed = get().feeds[tripId]
      if (!feed?.nextCursor || feed.loadingMore) return
      patch(tripId, { loadingMore: true })
      try {
        const { activities, nextCursor } = await fetchPage(tripId, feed.nextCursor)
        const seen = new Set(get().feeds[tripId].items.map((a) => a.id))
        patch(tripId, { items: [...get().feeds[tripId].items, ...activities.filter((a) => !seen.has(a.id))], nextCursor, loadingMore: false })
      } catch (error) {
        patch(tripId, { loadingMore: false, error: error.status === 401 ? null : error.message })
      }
    },

    /**
     * Called after this user changes something on the trip, so the new entry
     * shows up immediately. Skipped if the feed has never been opened — it
     * loads fresh when it is.
     */
    refresh(tripId) {
      if ((get().feeds[tripId]?.status ?? 'idle') === 'idle') return
      get().load(tripId)
    },
  }
})

export const EMPTY_FEED = EMPTY
