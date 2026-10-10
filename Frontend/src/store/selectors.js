// Derived-data hooks. Components select stable slices from the store and
// derive filtered/sorted views with useMemo, which keeps Zustand v5 selectors
// from returning fresh references on every render.

import { useMemo } from 'react'
import { useTripzyStore } from './useTripzyStore'
import { computeBalances, simplifyDebts } from '../utils/settlements'

export function useCurrentUser() {
  const currentUserId = useTripzyStore((s) => s.currentUserId)
  const users = useTripzyStore((s) => s.users)
  return useMemo(() => users.find((u) => u.id === currentUserId) ?? null, [users, currentUserId])
}

export function useUsersById() {
  const users = useTripzyStore((s) => s.users)
  return useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users])
}

export function useTrip(tripId) {
  return useTripzyStore((s) => s.trips.find((t) => t.id === tripId) ?? null)
}

export function useMyTrips() {
  const trips = useTripzyStore((s) => s.trips)
  const members = useTripzyStore((s) => s.members)
  const currentUserId = useTripzyStore((s) => s.currentUserId)
  return useMemo(() => {
    const mine = new Set(members.filter((m) => m.userId === currentUserId).map((m) => m.tripId))
    return trips.filter((t) => mine.has(t.id)).sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [trips, members, currentUserId])
}

export function useTripMembers(tripId) {
  const members = useTripzyStore((s) => s.members)
  const usersById = useUsersById()
  const presence = useTripzyStore((s) => s.presence)
  const currentUserId = useTripzyStore((s) => s.currentUserId)
  return useMemo(() => {
    const online = new Set([...(presence[tripId] ?? []), currentUserId])
    return members
      .filter((m) => m.tripId === tripId && usersById[m.userId])
      .map((m) => ({ ...usersById[m.userId], role: m.role, joinedAt: m.joinedAt, online: online.has(m.userId) }))
      .sort((a, b) => (a.role === 'LEADER' ? -1 : b.role === 'LEADER' ? 1 : a.name.localeCompare(b.name)))
  }, [members, usersById, presence, tripId, currentUserId])
}

export function useMembership(tripId) {
  const currentUserId = useTripzyStore((s) => s.currentUserId)
  return useTripzyStore((s) => s.members.find((m) => m.tripId === tripId && m.userId === currentUserId) ?? null)
}

export function useTripPlaces(tripId) {
  const places = useTripzyStore((s) => s.places)
  return useMemo(() => places.filter((p) => p.tripId === tripId), [places, tripId])
}

/** Vote totals per place, my vote per place, and a ranked list (ties → earliest added). */
export function useVoteSummary(tripId) {
  const places = useTripPlaces(tripId)
  const votes = useTripzyStore((s) => s.votes)
  const currentUserId = useTripzyStore((s) => s.currentUserId)
  return useMemo(() => {
    const placeIds = new Set(places.map((p) => p.id))
    const totals = {}
    const myVotes = {}
    for (const v of votes) {
      if (!placeIds.has(v.placeId)) continue
      const t = (totals[v.placeId] ??= { up: 0, down: 0, score: 0, voters: [] })
      if (v.value > 0) t.up += 1
      else t.down += 1
      t.score += v.value
      t.voters.push(v)
      if (v.userId === currentUserId) myVotes[v.placeId] = v.value
    }
    const ranked = [...places].sort(
      (a, b) => (totals[b.id]?.score ?? 0) - (totals[a.id]?.score ?? 0) || a.createdAt.localeCompare(b.createdAt),
    )
    return { totals, myVotes, ranked }
  }, [places, votes, currentUserId])
}

export function useItinerary(tripId) {
  const days = useTripzyStore((s) => s.itineraryDays)
  const items = useTripzyStore((s) => s.itineraryItems)
  return useMemo(() => {
    const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber)
    const dayIds = new Set(tripDays.map((d) => d.id))
    const byDay = Object.fromEntries(tripDays.map((d) => [d.id, []]))
    for (const item of items) if (dayIds.has(item.dayId)) byDay[item.dayId].push(item)
    for (const list of Object.values(byDay)) list.sort((a, b) => a.position - b.position)
    const scheduledPlaceIds = new Set(items.filter((i) => dayIds.has(i.dayId)).map((i) => i.placeId))
    return { days: tripDays, itemsByDay: byDay, scheduledPlaceIds }
  }, [days, items, tripId])
}

export function useTripExpenses(tripId) {
  const expenses = useTripzyStore((s) => s.expenses)
  return useMemo(
    () => expenses.filter((e) => e.tripId === tripId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [expenses, tripId],
  )
}

export function useBalances(tripId) {
  const members = useTripMembers(tripId)
  const expenses = useTripExpenses(tripId)
  const allSettlements = useTripzyStore((s) => s.settlements)
  return useMemo(() => {
    const settlements = allSettlements.filter((x) => x.tripId === tripId).sort((a, b) => b.settledAt.localeCompare(a.settledAt))
    const balances = computeBalances(members.map((m) => m.id), expenses, settlements)
    return { balances, suggested: simplifyDebts(balances), settlements }
  }, [members, expenses, allSettlements, tripId])
}

export function useTripPacking(tripId) {
  const items = useTripzyStore((s) => s.packingItems)
  return useMemo(() => items.filter((p) => p.tripId === tripId), [items, tripId])
}

export function useTripActivity(tripId, limit = 20) {
  const activity = useTripzyStore((s) => s.activity)
  return useMemo(
    () => activity.filter((a) => a.tripId === tripId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
    [activity, tripId, limit],
  )
}
