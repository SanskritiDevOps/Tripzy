import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarPlus, CalendarRange, Clock, Lightbulb, Map as MapIcon, Plus, RefreshCcw, Sparkles, ThumbsUp, Wallet, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CategoryIcon } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/States'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DayTimeline } from './DayTimeline'
import { StopFormModal } from './StopFormModal'
import { TripMap } from '../places/TripMap'
import { useTripContext } from '../trips/useTripContext'
import { useVoteSummary } from '../../store/selectors'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'
import { addDays, formatDate, formatDuration, timeToMinutes, todayIso, weekday } from '../../utils/dates'
import { tripsApi } from '../../api/endpoints'
import { formatMoney } from '../../utils/money'
import { nextSlot } from '../../utils/planner'
import { PLACE_CATEGORIES } from '../../data/categories'

export default function ItineraryTab() {
  const { trip, places, placesById, itinerary, permissions } = useTripContext()
  const { totals, ranked } = useVoteSummary(trip.id)
  const reorderDay = useTripzyStore((s) => s.reorderDay)
  const deleteItineraryItem = useTripzyStore((s) => s.deleteItineraryItem)
  const toggleItemLock = useTripzyStore((s) => s.toggleItemLock)
  const addItineraryItem = useTripzyStore((s) => s.addItineraryItem)
  const autoPlanTrip = useTripzyStore((s) => s.autoPlanTrip)
  const addDay = useTripzyStore((s) => s.addDay)

  const [params, setParams] = useSearchParams()
  const [stopModal, setStopModal] = useState(null) // { item?, initial? }
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [showMap, setShowMap] = useState(true)

  const { days, itemsByDay, scheduledPlaceIds } = itinerary
  const defaultDay = days.find((d) => d.date >= todayIso()) ?? days[0]
  const selectedDay = days.find((d) => String(d.dayNumber) === params.get('day')) ?? defaultDay
  const items = useMemo(() => (selectedDay ? itemsByDay[selectedDay.id] : []), [itemsByDay, selectedDay])

  const unscheduled = useMemo(
    () => ranked.filter((p) => !scheduledPlaceIds.has(p.id) && p.category !== 'stay' && p.category !== 'transit'),
    [ranked, scheduledPlaceIds],
  )

  if (!selectedDay) {
    return <EmptyState icon={CalendarRange} title="No days yet" description="Set trip dates to start building the itinerary." />
  }

  const dayMinutes = items.reduce((s, i) => s + i.durationMinutes, 0)
  const dayCost = items.reduce((s, i) => s + (i.costMinor ?? 0), 0)
  const dayStart = items[0]?.startTime
  const lastItem = items.at(-1)
  const dayEnd = lastItem ? timeToMinutes(lastItem.startTime) + lastItem.durationMinutes : null

  const selectDay = (day) => setParams({ day: String(day.dayNumber) }, { replace: true })

  async function runAutoPlan(dayId = null) {
    setPlanning(true)
    await new Promise((r) => setTimeout(r, 700)) // visible "thinking" state
    const added = autoPlanTrip(trip.id, dayId)
    setPlanning(false)
    if (added === 0) toast.info(dayId ? 'No unscheduled places fit this day.' : 'Every voted place is already scheduled — add more places to plan.')
    else toast.success(`Auto-plan added ${added} ${added === 1 ? 'stop' : 'stops'}, grouped by distance.`)
  }

  function quickAdd(place) {
    const startTime = nextSlot(items, placesById, place)
    if (timeToMinutes(startTime) + place.durationMinutes > 23 * 60) {
      toast.error(`Day ${selectedDay.dayNumber} is full — pick another day.`)
      return
    }
    addItineraryItem(selectedDay.id, { placeId: place.id, startTime, durationMinutes: place.durationMinutes })
    toast.success(`${place.name} added to Day ${selectedDay.dayNumber} at ${startTime}.`)
  }

  const mapPoints = items
    .map((item, index) => {
      const place = placesById[item.placeId]
      if (!place) return null
      return {
        id: item.id,
        lat: place.lat,
        lng: place.lng,
        color: PLACE_CATEGORIES[place.category]?.hex ?? '#64748b',
        label: index + 1,
        title: `${index + 1}. ${place.name}`,
        subtitle: `${item.startTime} · ${formatDuration(item.durationMinutes)}`,
      }
    })
    .filter(Boolean)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)_20rem]">
      {/* ── Day selector ─────────────────────────────────────── */}
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="mb-3 hidden items-center justify-between lg:flex">
          <h2 className="text-sm font-semibold text-slate-900">Days</h2>
          <span className="text-xs text-slate-400">{days.length} total</span>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible" role="tablist" aria-label="Itinerary days">
          {days.map((day) => {
            const dayItems = itemsByDay[day.id]
            const active = day.id === selectedDay.id
            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectDay(day)}
                className={clsx(
                  'flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all lg:w-full',
                  active ? 'bg-ocean-700 text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-sand-200 hover:ring-ocean-300',
                )}
              >
                <span className={clsx('grid size-10 shrink-0 place-items-center rounded-xl text-center leading-none', active ? 'bg-white/15' : 'bg-sand-100')}>
                  <span>
                    <span className={clsx('block text-[10px] font-semibold uppercase', active ? 'text-ocean-100' : 'text-slate-400')}>{weekday(day.date)}</span>
                    <span className="block text-base font-bold">{formatDate(day.date, { day: 'numeric' })}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Day {day.dayNumber}</span>
                  <span className={clsx('block text-xs', active ? 'text-ocean-100' : 'text-slate-400')}>
                    {dayItems.length ? `${dayItems.length} ${dayItems.length === 1 ? 'stop' : 'stops'}` : 'Empty'}
                  </span>
                </span>
              </button>
            )
          })}
          {permissions.canEditTripDetails && (
            <button
              type="button"
              onClick={async () => {
                try {
                  // Server trips: dates live in the API (any member may change them).
                  if (trip.remote) await tripsApi.update(trip.id, { startDate: trip.startDate, endDate: addDays(trip.endDate, 1) })
                  addDay(trip.id)
                  toast.success('Added a day to the end of the trip.')
                } catch (error) {
                  if (error.status !== 401) toast.error(error.details?.endDate ?? error.message)
                }
              }}
              className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-300 px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-ocean-400 hover:text-ocean-700 lg:w-full"
            >
              <CalendarPlus className="size-4" /> Add day
            </button>
          )}
        </div>
        <Card className="mt-4 hidden p-4 lg:block">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
            <Wand2 className="size-3.5" /> Auto-plan
          </p>
          <p className="mt-1 text-xs text-slate-500">Fills every day with unscheduled, upvoted places — grouped by distance. Locked and existing stops stay put.</p>
          <Button size="sm" variant="secondary" icon={Sparkles} className="mt-3 w-full" loading={planning} onClick={() => runAutoPlan()}>
            Plan whole trip
          </Button>
        </Card>
      </aside>

      {/* ── Selected day ─────────────────────────────────────── */}
      <section aria-labelledby="day-heading" className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-coral-600 uppercase">
              Day {selectedDay.dayNumber} of {days.length}
            </p>
            <h2 id="day-heading" className="font-display text-2xl font-semibold">
              {formatDate(selectedDay.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {dayStart ? `${dayStart} – ${String(Math.floor(dayEnd / 60)).padStart(2, '0')}:${String(dayEnd % 60).padStart(2, '0')}` : 'Nothing planned'}
              </span>
              <span>{formatDuration(dayMinutes)} of activities</span>
              {dayCost > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="size-3.5" /> ~{formatMoney(dayCost)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={RefreshCcw} loading={planning} onClick={() => setConfirmRegenerate(true)}>
              Regenerate day
            </Button>
            <Button size="sm" icon={Plus} onClick={() => setStopModal({ initial: { dayId: selectedDay.id } })}>
              Add stop
            </Button>
          </div>
        </div>

        <div className="mt-5">
          {items.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="This day is wide open"
              description="Add stops by hand, pick from the ideas list, or let auto-plan fill it from your group’s top-voted places."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button icon={Plus} onClick={() => setStopModal({ initial: { dayId: selectedDay.id } })}>
                    Add stop
                  </Button>
                  <Button variant="secondary" icon={Sparkles} loading={planning} onClick={() => runAutoPlan(selectedDay.id)}>
                    Auto-fill day
                  </Button>
                </div>
              }
            />
          ) : (
            <DayTimeline
              items={items}
              placesById={placesById}
              onReorder={(ids) => reorderDay(selectedDay.id, ids)}
              onEdit={(item) => setStopModal({ item })}
              onDelete={(item) => {
                deleteItineraryItem(item.id)
                toast.info(`${placesById[item.placeId]?.name ?? 'Stop'} removed from Day ${selectedDay.dayNumber}.`)
              }}
              onToggleLock={(item) => toggleItemLock(item.id)}
              canLock={permissions.isLeader}
              canEditStop={permissions.canEditStop}
            />
          )}
          {items.length > 1 && (
            <p className="mt-4 pl-[4.25rem] text-xs text-slate-400 sm:pl-[5.25rem]">Drag stops to reorder — times re-flow automatically. Locked stops keep their slot.</p>
          )}
        </div>

        <div className="mt-6 lg:hidden">
          <Button variant="secondary" icon={Sparkles} className="w-full" loading={planning} onClick={() => runAutoPlan()}>
            Auto-plan whole trip
          </Button>
        </div>
      </section>

      {/* ── Side panel ───────────────────────────────────────── */}
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapIcon className="size-4 text-ocean-600" /> Day {selectedDay.dayNumber} route
            </h3>
            <button type="button" onClick={() => setShowMap((s) => !s)} className="text-xs font-semibold text-ocean-700 hover:underline">
              {showMap ? 'Hide' : 'Show'}
            </button>
          </div>
          {showMap &&
            (mapPoints.length ? (
              <TripMap points={mapPoints} route={mapPoints} className="mx-4 mb-4 h-56 lg:h-60" />
            ) : (
              <p className="px-4 pb-4 text-xs text-slate-500">Add stops to see the route on the map.</p>
            ))}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-amber-500" /> Ideas not yet scheduled
            </h3>
            <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{unscheduled.length}</span>
          </div>
          {unscheduled.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">Everything on the places board is in the plan. Nice!</p>
          ) : (
            <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
              {unscheduled.map((place) => (
                <li key={place.id} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-sand-50">
                  <CategoryIcon category={place.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{place.name}</p>
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <span className={clsx('inline-flex items-center gap-0.5 font-semibold', (totals[place.id]?.score ?? 0) < 0 ? 'text-red-500' : 'text-emerald-600')}>
                        <ThumbsUp className="size-3" /> {totals[place.id]?.score ?? 0}
                      </span>
                      {formatDuration(place.durationMinutes)}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => quickAdd(place)} aria-label={`Add ${place.name} to Day ${selectedDay.dayNumber}`}>
                    Day {selectedDay.dayNumber}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>

      <StopFormModal
        canLock={permissions.isLeader}
        open={Boolean(stopModal)}
        onClose={() => setStopModal(null)}
        trip={trip}
        places={places}
        placesById={placesById}
        itinerary={itinerary}
        item={stopModal?.item}
        initial={stopModal?.initial}
      />
      <ConfirmDialog
        open={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        tone="primary"
        title={`Regenerate Day ${selectedDay.dayNumber}?`}
        description="Unlocked stops on this day are cleared and refilled from unscheduled, upvoted places near each other. Locked stops stay exactly where they are."
        confirmLabel="Regenerate"
        onConfirm={() => runAutoPlan(selectedDay.id)}
      />
    </div>
  )
}
