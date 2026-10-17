import { useMemo } from 'react'
import { expensesApi, itineraryApi, packingApi } from '../../api/endpoints'
import { useTripzyStore } from '../../store/useTripzyStore'
import { mutate, syncExpenses, syncItinerary, syncPacking } from './remoteData'

const STOP_FIELDS = ['dayId', 'placeId', 'startTime', 'durationMinutes', 'notes', 'costMinor']
const pick = (data, keys) => Object.fromEntries(keys.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]))

/**
 * Itinerary, expense and packing actions for one trip.
 * Saved trips go through the API (which enforces roles, locks and logs the
 * activity) and then reload from the server; example trips update locally.
 * Actions are async and reject with an ApiError the caller can show.
 */
export function useTripActions(trip) {
  const tripId = trip?.id
  const remote = Boolean(trip?.remote)

  return useMemo(() => {
    const store = useTripzyStore.getState
    const reloadItinerary = () => syncItinerary(tripId)
    const reloadExpenses = () => syncExpenses(tripId)
    const reloadPacking = () => syncPacking(tripId)

    const itinerary = {
      async addItem(dayId, data) {
        if (!remote) return store().addItineraryItem(dayId, data)
        const { item } = await mutate(() => itineraryApi.addItem(tripId, { ...pick({ ...data, dayId }, STOP_FIELDS), isLocked: Boolean(data.isLocked) }), reloadItinerary)
        return item.id
      },

      /** Same contract as the local store: { item } | { conflict, current } | { error }. */
      async updateItem(itemId, patch, version) {
        if (!remote) return store().updateItineraryItem(itemId, patch, version)
        const before = store().itineraryItems.find((i) => i.id === itemId)
        try {
          await itineraryApi.updateItem(tripId, itemId, { ...pick(patch, STOP_FIELDS), version })
          if (patch.isLocked !== undefined && patch.isLocked !== before?.isLocked) await itineraryApi.setLock(tripId, itemId, patch.isLocked)
        } catch (error) {
          if (error.code === 'VERSION_CONFLICT') {
            await reloadItinerary()
            return { conflict: true, current: error.details?.current ?? store().itineraryItems.find((i) => i.id === itemId) }
          }
          throw error
        } finally {
          await reloadItinerary().catch(() => {})
        }
        return { item: store().itineraryItems.find((i) => i.id === itemId) }
      },

      async deleteItem(itemId) {
        if (!remote) return store().deleteItineraryItem(itemId)
        await mutate(() => itineraryApi.deleteItem(tripId, itemId), reloadItinerary)
      },

      async toggleLock(item) {
        if (!remote) return store().toggleItemLock(item.id)
        await mutate(() => itineraryApi.setLock(tripId, item.id, !item.isLocked), reloadItinerary)
      },

      /** Optimistic: the new order and re-flowed times show immediately, then the server confirms. */
      async reorderDay(dayId, orderedIds) {
        store().reorderDay(dayId, orderedIds)
        if (!remote) return
        const items = store()
          .itineraryItems.filter((i) => i.dayId === dayId)
          .sort((a, b) => a.position - b.position)
          .map((i) => ({ id: i.id, startTime: i.startTime }))
        await mutate(() => itineraryApi.reorderDay(tripId, dayId, items), reloadItinerary)
      },

      /**
       * Saves a draft from the planner (server trips). New stops get the AI's tip as notes;
       * with replaceDayIds, those days' unlocked stops are cleared first. Returns the count added.
       */
      async savePlan(draft, { replaceDayIds = [] } = {}) {
        const items = draft.days.flatMap((day) =>
          day.stops
            .filter((stop) => !stop.fixed)
            .map((stop) => ({ dayId: day.dayId, placeId: stop.placeId, startTime: stop.startTime, durationMinutes: stop.durationMinutes, notes: stop.tip ?? '' })),
        )
        await mutate(() => itineraryApi.applyPlan(tripId, { replaceDayIds, engine: draft.engine, items }), reloadItinerary)
        return items.length
      },

      /** Auto-plan (whole trip) or regenerate one day. Returns the number of stops added. */
      async autoPlan(onlyDayId = null) {
        if (!remote) return store().autoPlanTrip(tripId, onlyDayId)
        const drafts = store().planDrafts(tripId, onlyDayId)
        if (drafts.length === 0 && !onlyDayId) return 0
        await mutate(() => itineraryApi.applyPlan(tripId, { ...(onlyDayId ? { replaceDayId: onlyDayId } : {}), items: drafts }), reloadItinerary)
        return drafts.length
      },
    }

    const expenses = {
      /** `participants` is what the API needs: [{ userId, value? }] (paise for EXACT, % for PERCENT). */
      async add(data, participants) {
        if (!remote) return store().addExpense(tripId, data)
        const body = { ...pick(data, ['title', 'amountMinor', 'paidBy', 'splitType', 'category']), participants }
        const { expense } = await mutate(() => expensesApi.create(tripId, body, data.idempotencyKey), reloadExpenses)
        return expense.id
      },

      async update(expenseId, data, participants) {
        if (!remote) return store().updateExpense(expenseId, data)
        const body = { ...pick(data, ['title', 'amountMinor', 'paidBy', 'splitType', 'category']), participants }
        await mutate(() => expensesApi.update(tripId, expenseId, body), reloadExpenses)
      },

      async remove(expenseId) {
        if (!remote) return store().deleteExpense(expenseId)
        await mutate(() => expensesApi.remove(tripId, expenseId), reloadExpenses)
      },

      async settle(payment) {
        if (!remote) return store().recordSettlement(tripId, payment)
        await mutate(() => expensesApi.settle(tripId, pick(payment, ['fromUser', 'toUser', 'amountMinor'])), reloadExpenses)
      },
    }

    const packing = {
      async add(data) {
        if (!remote) return store().addPackingItem(tripId, data)
        await mutate(() => packingApi.add(tripId, { label: data.label, category: data.category, ownerId: data.ownerId ?? null }), reloadPacking)
      },

      /** Optimistic tick, confirmed by the server. */
      async toggle(item) {
        store().togglePacked(item.id)
        if (!remote) return
        await mutate(() => packingApi.update(tripId, item.id, { packed: !item.packed }), reloadPacking)
      },

      async remove(itemId) {
        if (!remote) return store().deletePackingItem(itemId)
        await mutate(() => packingApi.remove(tripId, itemId), reloadPacking)
      },

      async reset() {
        if (!remote) return store().resetPacking(tripId)
        await mutate(() => packingApi.reset(tripId), reloadPacking)
      },
    }

    return { itinerary, expenses, packing }
  }, [tripId, remote])
}
