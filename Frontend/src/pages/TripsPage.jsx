import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CloudOff, Luggage, Plus, PlaneTakeoff, History, Globe2, Sparkles, RotateCcw, Eye, EyeOff } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'
import { SegmentedControl } from '../components/ui/Card'
import { TripCard } from '../features/trips/TripCard'
import { TripFormModal } from '../features/trips/TripFormModal'
import { useCurrentUser, useMyTrips, useUsersById } from '../store/selectors'
import { useTripzyStore } from '../store/useTripzyStore'
import { tripStatus } from '../utils/dates'
import { useRemoteTripsSync } from '../features/trips/useRemoteTripsSync'
import { toast } from '../store/useToastStore'

export function TripsPage() {
  const user = useCurrentUser()
  const allTrips = useMyTrips()
  // Saved trips are yours and shared with your group; the bundled ones are examples.
  const trips = useMemo(() => allTrips.filter((t) => t.remote), [allTrips])
  const examples = useMemo(() => allTrips.filter((t) => !t.remote), [allTrips])
  const examplesHidden = useTripzyStore((s) => s.examplesHidden)
  const setExamplesHidden = useTripzyStore((s) => s.setExamplesHidden)
  const resetExamples = useTripzyStore((s) => s.resetExamples)
  const usersById = useUsersById()
  const members = useTripzyStore((s) => s.members)
  const places = useTripzyStore((s) => s.places)
  const expenses = useTripzyStore((s) => s.expenses)
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState('upcoming')
  const { error: syncError } = useRemoteTripsSync()

  const creating = params.get('new') === '1'
  const prefill = {
    destination: params.get('destination') ?? undefined,
    start: params.get('start') ?? undefined,
    end: params.get('end') ?? undefined,
    group: params.get('group') ?? undefined,
  }

  const stats = useMemo(() => {
    const byTrip = {}
    for (const trip of allTrips) byTrip[trip.id] = { members: [], placeCount: 0, spentMinor: 0 }
    for (const m of members) if (byTrip[m.tripId] && usersById[m.userId]) byTrip[m.tripId].members.push(usersById[m.userId])
    for (const p of places) if (byTrip[p.tripId]) byTrip[p.tripId].placeCount += 1
    for (const e of expenses) if (byTrip[e.tripId]) byTrip[e.tripId].spentMinor += e.amountMinor
    // Saved trips: use the server's counts. This browser only has a trip's places and
    // expenses once it has been opened here (and they may be out of date).
    for (const trip of allTrips) {
      if (trip.remote && trip.stats) Object.assign(byTrip[trip.id], { placeCount: trip.stats.placeCount, spentMinor: trip.stats.spentMinor })
    }
    return byTrip
  }, [allTrips, members, places, expenses, usersById])

  const grouped = useMemo(() => {
    const upcoming = trips.filter((t) => tripStatus(t.startDate, t.endDate).kind !== 'past')
    const past = trips.filter((t) => tripStatus(t.startDate, t.endDate).kind === 'past').reverse()
    return { upcoming, past, all: [...upcoming, ...past] }
  }, [trips])

  const visible = grouped[filter]
  const openCreate = () => setParams({ new: '1' })
  const closeCreate = () => setParams({}, { replace: true })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-coral-600">Hi {user?.name.split(' ')[0]} 👋</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Your trips</h1>
          <p className="mt-1 text-sm text-slate-500">
            {grouped.upcoming.length} upcoming · {grouped.past.length} completed
          </p>
        </div>
        <Button icon={Plus} variant="accent" onClick={openCreate} className="self-start sm:self-auto">
          Plan a new trip
        </Button>
      </div>

      {syncError && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
          <CloudOff className="size-4 shrink-0" aria-hidden /> Couldn’t load trips from the server: {syncError}
        </p>
      )}

      <div className="mt-6 overflow-x-auto scrollbar-none">
        <SegmentedControl
          aria-label="Filter trips"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'upcoming', label: 'Upcoming', icon: PlaneTakeoff, count: grouped.upcoming.length },
            { value: 'past', label: 'Past', icon: History, count: grouped.past.length },
            { value: 'all', label: 'All', icon: Globe2, count: grouped.all.length },
          ]}
        />
      </div>

      <div className="mt-6">
        {visible.length === 0 ? (
          <EmptyState
            icon={Luggage}
            title={filter === 'past' ? 'No past trips yet' : trips.length ? 'No upcoming trips' : 'No trips yet'}
            description={
              filter === 'past'
                ? 'Trips you’ve completed will show up here.'
                : 'Start a trip, invite your friends and begin collecting places. Want a feel for it first? Open an example trip below.'
            }
            action={
              filter !== 'past' && (
                <Button icon={Plus} onClick={openCreate}>
                  Plan a trip
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                members={stats[trip.id].members}
                placeCount={stats[trip.id].placeCount}
                spentMinor={stats[trip.id].spentMinor}
                isLeader={members.some((m) => m.tripId === trip.id && m.userId === user?.id && m.role === 'LEADER')}
              />
            ))}
            {filter !== 'past' && (
              <button
                type="button"
                onClick={openCreate}
                className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-sand-300 text-slate-500 transition-colors hover:border-ocean-400 hover:bg-white hover:text-ocean-700"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-sand-100">
                  <Plus className="size-6" aria-hidden />
                </span>
                <span className="font-semibold">Start another trip</span>
              </button>
            )}
          </div>
        )}
      </div>

      {examples.length > 0 && (
        <section aria-labelledby="examples-heading" className="mt-14 border-t border-sand-200 pt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 id="examples-heading" className="flex items-center gap-2 font-display text-2xl font-semibold">
                <Sparkles className="size-5 text-violet-600" aria-hidden /> Example trips
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                See what a fully planned trip looks like: a day-by-day itinerary, group votes on places, costs split fairly and a shared packing list. Open
                one and try anything. Changes stay on this device and aren’t shared with anyone.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {!examplesHidden && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => {
                    resetExamples()
                    toast.success('Example trips reset to their original state.')
                  }}
                >
                  Reset examples
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={examplesHidden ? Eye : EyeOff} onClick={() => setExamplesHidden(!examplesHidden)}>
                {examplesHidden ? 'Show examples' : 'Hide examples'}
              </Button>
            </div>
          </div>
          {!examplesHidden && (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {examples.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  example
                  members={stats[trip.id].members}
                  placeCount={stats[trip.id].placeCount}
                  spentMinor={stats[trip.id].spentMinor}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <TripFormModal open={creating} onClose={closeCreate} prefill={prefill} />
    </div>
  )
}
