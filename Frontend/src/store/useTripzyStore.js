// Client-side stand-in for the REST API + database described in the README.
// Every action mirrors an endpoint so it can later be swapped for TanStack Query
// mutations without changing the components that call it.

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSeedData } from '../data/mockData'
import { findDestination } from '../data/destinations'
import { addDays, timeToMinutes, todayIso, tripLength } from '../utils/dates'
import { autoPlan, retimeItems } from '../utils/planner'

const STORAGE_KEY = 'tripzy-demo-state'
const AVATAR_COLORS = ['bg-ocean-600', 'bg-coral-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-600', 'bg-sky-600', 'bg-pink-500']

export function newId(prefix = 'id') {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${random}`
}

const now = () => new Date().toISOString()

function voteScores(votes) {
  const scores = {}
  for (const v of votes) scores[v.placeId] = (scores[v.placeId] ?? 0) + v.value
  return scores
}

/** Sorts a day's items by start time and rewrites `position`. */
function normalizeDay(items, dayId) {
  const dayItems = items
    .filter((i) => i.dayId === dayId)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.position - b.position)
  const positions = new Map(dayItems.map((item, index) => [item.id, index]))
  return items.map((i) => (positions.has(i.id) ? { ...i, position: positions.get(i.id) } : i))
}

function buildDays(tripId, startDate, endDate, existing = []) {
  const count = tripLength(startDate, endDate)
  return Array.from({ length: count }, (_, i) => {
    const prior = existing.find((d) => d.dayNumber === i + 1)
    return { id: prior?.id ?? newId('day'), tripId, dayNumber: i + 1, date: addDays(startDate, i) }
  })
}

/** Auto-plan for a trip (README §11 code-only path). Pure: reads state, returns drafts. */
function computePlanDrafts(s, tripId, onlyDayId) {
  let days = s.itineraryDays.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber)
  const dayIds = new Set(days.map((d) => d.id))
  let items = s.itineraryItems.filter((i) => dayIds.has(i.dayId))
  // Stops are kept when their time slot is locked or their place is locked by the leader.
  const lockedPlaceIds = new Set(s.places.filter((p) => p.tripId === tripId && p.isLocked).map((p) => p.id))
  const keepStop = (i) => i.isLocked || lockedPlaceIds.has(i.placeId)

  if (onlyDayId) {
    // Regenerate one day: drop its unlocked stops, keep locked ones, then refill only that day.
    items = items.filter((i) => i.dayId !== onlyDayId || keepStop(i))
    days = days.filter((d) => d.id === onlyDayId)
  }

  const drafts = autoPlan({
    days,
    items,
    places: s.places.filter((p) => p.tripId === tripId),
    scores: voteScores(s.votes),
  })
  return { drafts, keepStop }
}

const STARTER_PACKING = [
  ['documents', 'ID / passport'],
  ['documents', 'Tickets & bookings'],
  ['clothing', 'Comfortable shoes'],
  ['toiletries', 'Toiletries kit'],
  ['electronics', 'Phone charger'],
  ['electronics', 'Power bank'],
  ['health', 'Basic medicines'],
  ['gear', 'Reusable water bottle'],
]

export const useTripzyStore = create(
  persist(
    (set, get) => {
      const log = (tripId, type, payload) =>
        set((s) => ({
          activity: [{ id: newId('act'), tripId, actorId: s.currentUserId, type, payload, createdAt: now() }, ...s.activity].slice(0, 200),
        }))

      return {
        ...createSeedData(),
        // Set from the authenticated API session (see useAuthStore).
        currentUserId: null,
        sessionUserId: null,

        // ── Session identity ───────────────────────────────────────────
        /**
         * Binds local trip data to the logged-in account. A different account
         * than last time gets a fresh copy of the demo data with itself as the
         * main traveller; the same account keeps its local changes.
         */
        attachSessionUser: (user) => {
          const profile = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null }
          if (get().sessionUserId !== user.id) {
            set({ ...createSeedData(profile), currentUserId: user.id, sessionUserId: user.id })
            return
          }
          set((s) => ({
            currentUserId: user.id,
            users: s.users.map((u) => (u.id === user.id ? { ...u, name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null } : u)),
          }))
        },
        /**
         * On logout, drop every saved (server) trip from this browser: their places,
         * expenses and members' emails are stored in localStorage and would
         * otherwise stay readable on a shared computer. They reload from the server
         * on the next login. Bundled demo trips stay.
         */
        detachSessionUser: () =>
          set((s) => {
            const gone = new Set(s.trips.filter((t) => t.remote).map((t) => t.id))
            if (gone.size === 0) return { currentUserId: null }
            const keep = (row) => !gone.has(row.tripId)
            const dayIds = new Set(s.itineraryDays.filter((d) => gone.has(d.tripId)).map((d) => d.id))
            const placeIds = new Set(s.places.filter((pl) => gone.has(pl.tripId)).map((pl) => pl.id))
            const members = s.members.filter(keep)
            const stillNeeded = new Set([s.sessionUserId, ...members.map((m) => m.userId)])
            return {
              currentUserId: null,
              trips: s.trips.filter((t) => !gone.has(t.id)),
              members,
              users: s.users.filter((u) => stillNeeded.has(u.id)),
              invites: s.invites.filter(keep),
              places: s.places.filter(keep),
              votes: s.votes.filter((v) => !placeIds.has(v.placeId)),
              itineraryDays: s.itineraryDays.filter(keep),
              itineraryItems: s.itineraryItems.filter((i) => !dayIds.has(i.dayId)),
              expenses: s.expenses.filter(keep),
              settlements: s.settlements.filter(keep),
              packingItems: s.packingItems.filter(keep),
              activity: s.activity.filter(keep),
              presence: Object.fromEntries(Object.entries(s.presence).filter(([tripId]) => !gone.has(tripId))),
            }
          }),

        /**
         * Mirrors trips stored on the server (GET /api/trips) into local state:
         * new ones are added with empty itinerary days, changed ones updated,
         * and server trips that disappeared (deleted / removed from) dropped.
         */
        syncRemoteTrips: (remoteTrips) =>
          set((s) => {
            const remoteIds = new Set(remoteTrips.map((t) => t.id))
            const gone = new Set(s.trips.filter((t) => t.remote && !remoteIds.has(t.id)).map((t) => t.id))
            const users = [...s.users]
            for (const m of remoteTrips.flatMap((t) => t.members)) {
              if (!users.some((u) => u.id === m.id)) {
                users.push({ id: m.id, name: m.name, email: m.email, avatarUrl: m.avatarUrl ?? null, color: AVATAR_COLORS[users.length % AVATAR_COLORS.length] })
              }
            }
            let trips = s.trips.filter((t) => !gone.has(t.id))
            let itineraryDays = s.itineraryDays.filter((d) => !gone.has(d.tripId))
            let packingItems = s.packingItems.filter((p) => !gone.has(p.tripId))
            for (const remote of remoteTrips) {
              const fields = {
                id: remote.id,
                name: remote.name,
                destination: remote.destination,
                // Recomputed every sync: someone may have changed the destination.
                destinationId: findDestination(remote.destination)?.id ?? null,
                destinationLat: remote.destinationLat ?? null,
                destinationLng: remote.destinationLng ?? null,
                // Server-side card stats (place count, total spent) for "My trips".
                stats: remote.stats ?? null,
                startDate: remote.startDate,
                endDate: remote.endDate,
                currency: remote.currency,
                budgetMinor: remote.budgetMinor,
                groupType: remote.groupType,
                ownerId: remote.ownerId,
                votingDeadline: remote.votingDeadline,
                createdAt: remote.createdAt,
                remote: true,
              }
              const local = trips.find((t) => t.id === remote.id)
              // Days, stops, votes, expenses and packing for server trips are loaded
              // by the workspace (syncRemote* below), not built locally.
              if (local) {
                trips = trips.map((t) => (t.id === remote.id ? { ...t, ...fields } : t))
              } else {
                trips = [{ ...fields, shareToken: newId('share').slice(6, 18) }, ...trips]
              }
            }
            const members = [
              ...s.members.filter((m) => !remoteIds.has(m.tripId) && !gone.has(m.tripId)),
              ...remoteTrips.flatMap((t) => t.members.map((m) => ({ tripId: t.id, userId: m.id, role: m.role, joinedAt: m.joinedAt }))),
            ]
            const dayIds = new Set(itineraryDays.map((d) => d.id))
            return {
              users,
              trips,
              members,
              itineraryDays,
              packingItems,
              itineraryItems: s.itineraryItems.filter((i) => dayIds.has(i.dayId)),
            }
          }),

        // ── Server data for saved trips (replaces that trip's local copy) ──
        syncRemoteItinerary: (tripId, days) =>
          set((s) => {
            const dayIds = new Set(s.itineraryDays.filter((d) => d.tripId === tripId).map((d) => d.id))
            return {
              itineraryDays: [...s.itineraryDays.filter((d) => d.tripId !== tripId), ...days.map((d) => ({ id: d.id, tripId, dayNumber: d.dayNumber, date: d.date }))],
              itineraryItems: [...s.itineraryItems.filter((i) => !dayIds.has(i.dayId)), ...days.flatMap((d) => d.items)],
            }
          }),

        /** `people`: everyone the money mentions, including members who have left (so their names still show). */
        syncRemoteExpenses: (tripId, { expenses, settlements, people = [] }) =>
          set((s) => {
            const users = [...s.users]
            for (const person of people) {
              if (users.some((u) => u.id === person.id)) continue
              users.push({ id: person.id, name: person.name, email: '', avatarUrl: person.avatarUrl ?? null, color: AVATAR_COLORS[users.length % AVATAR_COLORS.length] })
            }
            return {
              users,
              expenses: [...s.expenses.filter((e) => e.tripId !== tripId), ...expenses],
              settlements: [...s.settlements.filter((x) => x.tripId !== tripId), ...settlements],
            }
          }),

        syncRemotePacking: (tripId, items) =>
          set((s) => ({ packingItems: [...s.packingItems.filter((p) => p.tripId !== tripId), ...items] })),

        /** Who has this trip open right now (from the Socket.IO room; demo trips keep their simulated list). */
        setPresence: (tripId, userIds) => set((s) => ({ presence: { ...s.presence, [tripId]: userIds } })),

        // ── Trips & members ────────────────────────────────────────────
        /** Adds a trip locally. Pass `id` and `remote: true` for trips already created via POST /api/trips. */
        createTrip: ({ id = null, remote = false, name, destination, destinationId = null, startDate, endDate, budgetMinor = 0, groupType = 'friends' }) => {
          const { currentUserId } = get()
          const tripId = id ?? newId('trip')
          const trip = {
            id: tripId,
            remote,
            name: name.trim(),
            destination: destination.trim(),
            destinationId,
            startDate,
            endDate,
            currency: 'INR',
            budgetMinor,
            groupType,
            ownerId: currentUserId,
            votingDeadline: null,
            shareToken: newId('share').slice(6, 18),
            createdAt: now(),
          }
          set((s) => ({
            trips: [trip, ...s.trips],
            members: [...s.members, { tripId, userId: currentUserId, role: 'LEADER', joinedAt: now() }],
            // Server trips get their days and starter packing list from the API.
            itineraryDays: remote ? s.itineraryDays : [...s.itineraryDays, ...buildDays(tripId, startDate, endDate)],
            packingItems: remote
              ? s.packingItems
              : [
                  ...s.packingItems,
                  ...STARTER_PACKING.map(([category, label]) => ({ id: newId('pk'), tripId, category, label, packed: false, ownerId: null })),
                ],
          }))
          log(tripId, 'TRIP_CREATED', { name: trip.name })
          return tripId
        },

        updateTrip: (tripId, patch) => {
          const trip = get().trips.find((t) => t.id === tripId)
          if (!trip) return
          const next = { ...trip, ...patch }
          set((s) => {
            let { itineraryDays, itineraryItems } = s
            if (patch.startDate || patch.endDate) {
              const existing = itineraryDays.filter((d) => d.tripId === tripId)
              const rebuilt = buildDays(tripId, next.startDate, next.endDate, existing)
              const keep = new Set(rebuilt.map((d) => d.id))
              const removed = new Set(existing.filter((d) => !keep.has(d.id)).map((d) => d.id))
              itineraryDays = [...itineraryDays.filter((d) => d.tripId !== tripId), ...rebuilt]
              itineraryItems = itineraryItems.filter((i) => !removed.has(i.dayId))
            }
            return { trips: s.trips.map((t) => (t.id === tripId ? next : t)), itineraryDays, itineraryItems }
          })
          log(tripId, 'TRIP_UPDATED', { name: next.name })
        },

        deleteTrip: (tripId) =>
          set((s) => {
            const dayIds = new Set(s.itineraryDays.filter((d) => d.tripId === tripId).map((d) => d.id))
            const placeIds = new Set(s.places.filter((p) => p.tripId === tripId).map((p) => p.id))
            return {
              trips: s.trips.filter((t) => t.id !== tripId),
              members: s.members.filter((m) => m.tripId !== tripId),
              invites: s.invites.filter((i) => i.tripId !== tripId),
              places: s.places.filter((p) => p.tripId !== tripId),
              votes: s.votes.filter((v) => !placeIds.has(v.placeId)),
              itineraryDays: s.itineraryDays.filter((d) => d.tripId !== tripId),
              itineraryItems: s.itineraryItems.filter((i) => !dayIds.has(i.dayId)),
              expenses: s.expenses.filter((e) => e.tripId !== tripId),
              settlements: s.settlements.filter((x) => x.tripId !== tripId),
              packingItems: s.packingItems.filter((p) => p.tripId !== tripId),
              activity: s.activity.filter((a) => a.tripId !== tripId),
            }
          }),

        createInvite: (tripId) => {
          const invite = {
            id: newId('inv'),
            tripId,
            token: newId('t').slice(2, 14),
            expiresAt: addDays(todayIso(), 7) + 'T23:59:00',
            createdBy: get().currentUserId,
          }
          set((s) => ({ invites: [...s.invites, invite] }))
          return invite
        },

        joinTrip: (token) => {
          const { invites, members, currentUserId, users } = get()
          const invite = invites.find((i) => i.token === token)
          if (!invite) return { error: 'This invite link is invalid.' }
          if (new Date(invite.expiresAt) < new Date()) return { error: 'This invite link has expired. Ask the team leader for a new one.' }
          const already = members.some((m) => m.tripId === invite.tripId && m.userId === currentUserId)
          if (!already) {
            set((s) => ({ members: [...s.members, { tripId: invite.tripId, userId: currentUserId, role: 'MEMBER', joinedAt: now() }] }))
            log(invite.tripId, 'MEMBER_JOINED', { name: users.find((u) => u.id === currentUserId)?.name })
          }
          return { tripId: invite.tripId }
        },

        removeMember: (tripId, userId) => {
          set((s) => ({ members: s.members.filter((m) => !(m.tripId === tripId && m.userId === userId)) }))
          log(tripId, 'MEMBER_LEFT', { userId })
        },

        // ── Places & votes ─────────────────────────────────────────────
        /** Adds a place locally. Pass `id` (and the other server fields) for places created via the API. */
        addPlace: (tripId, data) => {
          const place = {
            id: data.id ?? newId('place'),
            tripId,
            addedBy: data.addedBy ?? get().currentUserId,
            name: data.name.trim(),
            address: data.address?.trim() ?? '',
            lat: data.lat,
            lng: data.lng,
            category: data.category,
            notes: data.notes?.trim() ?? '',
            durationMinutes: data.durationMinutes ?? 60,
            isLocked: data.isLocked ?? false,
            lockedById: data.lockedById ?? null,
            createdAt: data.createdAt ?? now(),
          }
          set((s) => ({ places: [...s.places, place] }))
          log(tripId, 'PLACE_ADDED', { name: place.name })
          return place.id
        },

        updatePlace: (placeId, patch) =>
          set((s) => ({ places: s.places.map((p) => (p.id === placeId ? { ...p, ...patch } : p)) })),

        deletePlace: (placeId) => {
          const place = get().places.find((p) => p.id === placeId)
          set((s) => ({
            places: s.places.filter((p) => p.id !== placeId),
            votes: s.votes.filter((v) => v.placeId !== placeId),
            itineraryItems: s.itineraryItems.filter((i) => i.placeId !== placeId),
          }))
          if (place) log(place.tripId, 'PLACE_DELETED', { name: place.name })
        },

        /** PUT /places/:id/vote — clicking the same value again removes the vote. */
        castVote: (placeId, value) => {
          const { places, trips, votes, currentUserId } = get()
          const place = places.find((p) => p.id === placeId)
          const trip = trips.find((t) => t.id === place?.tripId)
          if (!place || !trip) return { error: 'Place not found.' }
          if (trip.votingDeadline && new Date(trip.votingDeadline) < new Date()) return { error: 'Voting has closed for this trip.' }
          const existing = votes.find((v) => v.placeId === placeId && v.userId === currentUserId)
          if (existing?.value === value) {
            set((s) => ({ votes: s.votes.filter((v) => v.id !== existing.id) }))
          } else if (existing) {
            set((s) => ({ votes: s.votes.map((v) => (v.id === existing.id ? { ...v, value } : v)) }))
          } else {
            set((s) => ({ votes: [...s.votes, { id: newId('vote'), placeId, userId: currentUserId, value }] }))
          }
          if (existing?.value !== value) log(trip.id, 'VOTED', { name: place.name, value })
          return {}
        },

        setVotingDeadline: (tripId, deadline) =>
          set((s) => ({ trips: s.trips.map((t) => (t.id === tripId ? { ...t, votingDeadline: deadline } : t)) })),

        /** Closes voting now and locks every place with a positive score as a winner. */
        closeVoting: (tripId) => {
          const scores = voteScores(get().votes)
          set((s) => ({
            trips: s.trips.map((t) => (t.id === tripId ? { ...t, votingDeadline: now() } : t)),
            places: s.places.map((p) =>
              p.tripId === tripId && (scores[p.id] ?? 0) > 0 ? { ...p, isLocked: true, lockedById: s.currentUserId } : p,
            ),
          }))
          log(tripId, 'VOTING_CLOSED', {})
        },

        // Reopening voting keeps existing locks; the leader unlocks places individually.
        reopenVoting: (tripId) => set((s) => ({ trips: s.trips.map((t) => (t.id === tripId ? { ...t, votingDeadline: null } : t)) })),

        /** Leader-only in the UI and enforced by the API for server trips. */
        setPlaceLock: (placeId, locked) => {
          const place = get().places.find((p) => p.id === placeId)
          set((s) => ({
            places: s.places.map((p) => (p.id === placeId ? { ...p, isLocked: locked, lockedById: locked ? s.currentUserId : null } : p)),
          }))
          if (place) log(place.tripId, locked ? 'PLACE_LOCKED' : 'PLACE_UNLOCKED', { name: place.name })
        },

        /**
         * Replaces a server trip's places with GET /api/trips/:id/places.
         * Itinerary stops whose place no longer exists are dropped.
         */
        syncRemotePlaces: (tripId, remotePlaces) =>
          set((s) => {
            const incoming = remotePlaces.map((p) => ({
              id: p.id,
              tripId,
              addedBy: p.addedBy,
              name: p.name,
              address: p.address,
              lat: p.lat,
              lng: p.lng,
              category: p.category,
              notes: p.notes,
              durationMinutes: p.durationMinutes,
              isLocked: p.isLocked,
              lockedById: p.lockedById,
              createdAt: p.createdAt,
            }))
            const keep = new Set(incoming.map((p) => p.id))
            const tripDayIds = new Set(s.itineraryDays.filter((d) => d.tripId === tripId).map((d) => d.id))
            const oldPlaceIds = new Set(s.places.filter((p) => p.tripId === tripId).map((p) => p.id))
            const votes = remotePlaces.flatMap((p) => (p.votes ?? []).map((v) => ({ id: `${p.id}:${v.userId}`, placeId: p.id, userId: v.userId, value: v.value })))
            return {
              votes: [...s.votes.filter((v) => !oldPlaceIds.has(v.placeId)), ...votes],
              places: [...s.places.filter((p) => p.tripId !== tripId), ...incoming],
              itineraryItems: s.itineraryItems.filter((i) => !tripDayIds.has(i.dayId) || keep.has(i.placeId)),
            }
          }),

        // ── Itinerary ──────────────────────────────────────────────────
        addItineraryItem: (dayId, data) => {
          const item = {
            id: newId('item'),
            dayId,
            placeId: data.placeId,
            position: 999,
            startTime: data.startTime,
            durationMinutes: data.durationMinutes,
            isLocked: data.isLocked ?? false,
            source: data.source ?? 'MANUAL',
            notes: data.notes ?? '',
            costMinor: data.costMinor ?? 0,
            version: 1,
          }
          set((s) => ({ itineraryItems: normalizeDay([...s.itineraryItems, item], dayId) }))
          const day = get().itineraryDays.find((d) => d.id === dayId)
          const place = get().places.find((p) => p.id === data.placeId)
          if (day) log(day.tripId, 'ITINERARY_UPDATED', { name: place?.name, day: day.dayNumber })
          return item.id
        },

        /**
         * PATCH /itinerary/items/:id with optimistic versioning (README §10.5).
         * Pass the version you last saw; a newer server version returns { conflict }.
         */
        updateItineraryItem: (itemId, patch, expectedVersion) => {
          const item = get().itineraryItems.find((i) => i.id === itemId)
          if (!item) return { error: 'This stop no longer exists.' }
          if (expectedVersion != null && expectedVersion !== item.version) return { conflict: true, current: item }
          const next = { ...item, ...patch, version: item.version + 1 }
          set((s) => {
            let items = s.itineraryItems.map((i) => (i.id === itemId ? next : i))
            items = normalizeDay(items, next.dayId)
            if (next.dayId !== item.dayId) items = normalizeDay(items, item.dayId)
            return { itineraryItems: items }
          })
          return { item: next }
        },

        deleteItineraryItem: (itemId) => {
          const item = get().itineraryItems.find((i) => i.id === itemId)
          if (!item) return
          set((s) => ({ itineraryItems: normalizeDay(s.itineraryItems.filter((i) => i.id !== itemId), item.dayId) }))
        },

        toggleItemLock: (itemId) =>
          set((s) => ({
            itineraryItems: s.itineraryItems.map((i) => (i.id === itemId ? { ...i, isLocked: !i.isLocked, version: i.version + 1 } : i)),
          })),

        /** PATCH /trips/:id/itinerary/reorder — new order, then times are re-chained. */
        reorderDay: (dayId, orderedIds) =>
          set((s) => {
            const placesById = Object.fromEntries(s.places.map((p) => [p.id, p]))
            const dayItems = s.itineraryItems.filter((i) => i.dayId === dayId)
            const byId = Object.fromEntries(dayItems.map((i) => [i.id, i]))
            const firstStart = dayItems.reduce(
              (min, i) => (timeToMinutes(i.startTime) < timeToMinutes(min) ? i.startTime : min),
              dayItems[0]?.startTime ?? '09:00',
            )
            const ordered = orderedIds.map((id, position) => ({ ...byId[id], position, version: byId[id].version + 1 }))
            const retimed = Object.fromEntries(retimeItems(ordered, placesById, firstStart).map((i) => [i.id, i]))
            return { itineraryItems: s.itineraryItems.map((i) => retimed[i.id] ?? i) }
          }),

        addDay: (tripId) => {
          const trip = get().trips.find((t) => t.id === tripId)
          if (!trip) return
          get().updateTrip(tripId, { endDate: addDays(trip.endDate, 1) })
        },

        /** Code-only planner (README §11 fallback). Returns the number of stops added. */
        /** Computes auto-plan drafts without saving them (server trips send these to the API). */
        planDrafts: (tripId, onlyDayId = null) => computePlanDrafts(get(), tripId, onlyDayId).drafts,

        autoPlanTrip: (tripId, onlyDayId = null) => {
          const { drafts, keepStop } = computePlanDrafts(get(), tripId, onlyDayId)

          set((state) => {
            let next = state.itineraryItems
            if (onlyDayId) next = next.filter((i) => i.dayId !== onlyDayId || keepStop(i))
            const created = drafts.map((d) => ({
              id: newId('item'),
              position: 999,
              isLocked: false,
              source: 'AI',
              notes: '',
              costMinor: 0,
              version: 1,
              ...d,
            }))
            next = [...next, ...created]
            for (const dayId of new Set([...created.map((c) => c.dayId), ...(onlyDayId ? [onlyDayId] : [])])) {
              next = normalizeDay(next, dayId)
            }
            return { itineraryItems: next }
          })
          log(tripId, 'ITINERARY_GENERATED', { count: drafts.length })
          return drafts.length
        },

        // ── Expenses & settlements ─────────────────────────────────────
        /** POST /trips/:id/expenses — the idempotency key makes double-submits harmless. */
        addExpense: (tripId, data) => {
          const duplicate = get().expenses.find((e) => e.idempotencyKey === data.idempotencyKey)
          if (duplicate) return duplicate.id
          const expense = {
            id: newId('exp'),
            tripId,
            title: data.title.trim(),
            amountMinor: data.amountMinor,
            currency: 'INR',
            paidBy: data.paidBy,
            splitType: data.splitType,
            category: data.category,
            splits: data.splits,
            idempotencyKey: data.idempotencyKey,
            createdAt: now(),
          }
          set((s) => ({ expenses: [expense, ...s.expenses] }))
          log(tripId, 'EXPENSE_ADDED', { title: expense.title, amountMinor: expense.amountMinor })
          return expense.id
        },

        updateExpense: (expenseId, patch) => {
          const expense = get().expenses.find((e) => e.id === expenseId)
          if (!expense) return
          set((s) => ({ expenses: s.expenses.map((e) => (e.id === expenseId ? { ...e, ...patch } : e)) }))
          log(expense.tripId, 'EXPENSE_UPDATED', { title: patch.title ?? expense.title })
        },

        deleteExpense: (expenseId) => {
          const expense = get().expenses.find((e) => e.id === expenseId)
          if (!expense) return
          set((s) => ({ expenses: s.expenses.filter((e) => e.id !== expenseId) }))
          log(expense.tripId, 'EXPENSE_DELETED', { title: expense.title })
        },

        recordSettlement: (tripId, { fromUser, toUser, amountMinor }) => {
          set((s) => ({
            settlements: [...s.settlements, { id: newId('set'), tripId, fromUser, toUser, amountMinor, settledAt: now() }],
          }))
          log(tripId, 'SETTLED', { from: fromUser, to: toUser, amountMinor })
        },

        // ── Packing checklist ──────────────────────────────────────────
        addPackingItem: (tripId, { label, category, ownerId = null }) =>
          set((s) => ({
            packingItems: [...s.packingItems, { id: newId('pk'), tripId, label: label.trim(), category, packed: false, ownerId }],
          })),
        togglePacked: (itemId) =>
          set((s) => ({ packingItems: s.packingItems.map((p) => (p.id === itemId ? { ...p, packed: !p.packed } : p)) })),
        deletePackingItem: (itemId) => set((s) => ({ packingItems: s.packingItems.filter((p) => p.id !== itemId) })),
        resetPacking: (tripId) =>
          set((s) => ({ packingItems: s.packingItems.map((p) => (p.tripId === tripId ? { ...p, packed: false } : p)) })),

        // ── Demo ───────────────────────────────────────────────────────
        resetDemo: () => {
          const { users, sessionUserId } = get()
          const me = users.find((u) => u.id === sessionUserId)
          set({
            ...createSeedData(me ? { id: me.id, name: me.name, email: me.email, avatarUrl: me.avatarUrl } : undefined),
            currentUserId: sessionUserId,
            sessionUserId,
          })
        },
      }
    },
    {
      name: STORAGE_KEY,
      // v3: roles are LEADER/MEMBER (was OWNER/MEMBER); older local data is discarded.
      version: 3,
      migrate: () => ({}),
      storage: createJSONStorage(() => {
        try {
          const probe = '__tripzy_probe__'
          window.localStorage.setItem(probe, probe)
          window.localStorage.removeItem(probe)
          return window.localStorage
        } catch {
          // Private mode / blocked storage: fall back to an in-memory store.
          const memory = new Map()
          return {
            getItem: (k) => memory.get(k) ?? null,
            setItem: (k, v) => memory.set(k, v),
            removeItem: (k) => memory.delete(k),
          }
        }
      }),
      partialize: (state) => Object.fromEntries(Object.entries(state).filter(([, value]) => typeof value !== 'function')),
    },
  ),
)
