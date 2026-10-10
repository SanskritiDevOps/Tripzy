import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Crown, Hourglass, List, Map as MapIcon, MapPinPlus, MapPinned, Search, Trophy, Vote } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SegmentedControl } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/States'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Input } from '../../components/ui/Field'
import { PlaceCard } from './PlaceCard'
import { PlaceFormModal } from './PlaceFormModal'
import { TripMap } from './TripMap'
import { StopFormModal } from '../itinerary/StopFormModal'
import { useTripContext } from '../trips/useTripContext'
import { useVoteSummary } from '../../store/selectors'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'
import { PLACE_CATEGORIES, PLACE_CATEGORY_KEYS } from '../../data/categories'
import { tripCenter } from './placeSearch'
import { usePlaceActions } from './usePlaceActions'

function votingState(trip) {
  if (!trip.votingDeadline) return { open: true, label: 'Voting is open', detail: 'No deadline set' }
  const ms = new Date(trip.votingDeadline) - new Date()
  if (ms <= 0) return { open: false, label: 'Voting closed', detail: 'Winners are locked' }
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return { open: true, label: 'Voting is open', detail: days > 0 ? `Closes in ${days}d ${hours}h` : `Closes in ${hours}h` }
}

export default function PlacesTab() {
  const { trip, places, itinerary, permissions, usersById } = useTripContext()
  const { totals, myVotes, ranked } = useVoteSummary(trip.id)
  const castVote = useTripzyStore((s) => s.castVote)
  const placeActions = usePlaceActions(trip)
  const reopenVoting = useTripzyStore((s) => s.reopenVoting)

  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('popular')
  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [placeModal, setPlaceModal] = useState(null) // { place? }
  const [scheduling, setScheduling] = useState(null) // place
  const [deleting, setDeleting] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)

  const voting = votingState(trip)
  const rankOf = useMemo(() => Object.fromEntries(ranked.map((p, i) => [p.id, i + 1])), [ranked])
  const scheduledDayOf = useMemo(() => {
    const map = {}
    for (const day of itinerary.days) for (const item of itinerary.itemsByDay[day.id]) map[item.placeId] ??= day.dayNumber
    return map
  }, [itinerary])

  const counts = useMemo(() => {
    const c = { all: places.length }
    for (const p of places) c[p.category] = (c[p.category] ?? 0) + 1
    return c
  }, [places])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = sort === 'popular' ? ranked : [...places].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return list.filter((p) => (category === 'all' || p.category === category) && (!needle || `${p.name} ${p.address} ${p.notes}`.toLowerCase().includes(needle)))
  }, [ranked, places, sort, category, search])

  const podium = ranked.filter((p) => (totals[p.id]?.score ?? 0) > 0).slice(0, 3)

  const mapPoints = visible.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    color: PLACE_CATEGORIES[p.category]?.hex ?? '#64748b',
    label: rankOf[p.id] <= 9 ? rankOf[p.id] : '',
    title: p.name,
    subtitle: `${PLACE_CATEGORIES[p.category]?.label} · score ${totals[p.id]?.score ?? 0}`,
  }))

  /** Runs a place action and reports API errors (e.g. the 403 lock message) as a toast. */
  async function run(action, success) {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      if (error.status !== 401) toast.error(error.message)
    }
  }

  function vote(place, value) {
    const result = castVote(place.id, value)
    if (result.error) toast.error(result.error)
  }

  const mapPanel = (
    <TripMap
      points={mapPoints}
      center={tripCenter(trip, places)}
      selectedId={selectedId}
      onSelect={(id) => {
        setSelectedId(id)
        document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }}
      className="h-[60vh] lg:h-[calc(100dvh-7rem)]"
    />
  )

  return (
    <div className="space-y-5">
      {/* Voting banner */}
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <span className={clsx('grid size-11 shrink-0 place-items-center rounded-xl', voting.open ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
          {voting.open ? <Vote className="size-5" /> : <Crown className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            {voting.label} <span className="font-normal text-slate-500">· {voting.detail}</span>
          </p>
          {podium.length > 0 ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <Trophy className="size-3.5 text-amber-500" />
              {podium.map((p, i) => (
                <span key={p.id}>
                  <span className="font-semibold text-slate-700">
                    {i + 1}. {p.name}
                  </span>{' '}
                  <span className="text-emerald-600">+{totals[p.id].score}</span>
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-500">Vote on places to build the group’s “Most popular” list.</p>
          )}
        </div>
        {permissions.canManageVoting &&
          (voting.open ? (
            <Button variant="secondary" size="sm" icon={Hourglass} onClick={() => setConfirmClose(true)}>
              Close voting
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={Vote}
              onClick={() => {
                reopenVoting(trip.id)
                toast.success('Voting reopened.')
              }}
            >
              Reopen voting
            </Button>
          ))}
      </Card>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1 lg:max-w-sm">
          <Input icon={Search} placeholder="Filter places…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter places" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            size="sm"
            aria-label="Sort places"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'popular', label: 'Most popular' },
              { value: 'newest', label: 'Newest' },
            ]}
          />
          <SegmentedControl
            size="sm"
            aria-label="View"
            className="lg:hidden"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List', icon: List },
              { value: 'map', label: 'Map', icon: MapIcon },
            ]}
          />
          <Button icon={MapPinPlus} size="sm" className="ml-auto" onClick={() => setPlaceModal({})}>
            Add place
          </Button>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
        {['all', ...PLACE_CATEGORY_KEYS].map((key) => {
          const config = PLACE_CATEGORIES[key]
          const Icon = config?.icon ?? MapPinned
          const active = category === key
          if (key !== 'all' && !counts[key]) return null
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(key)}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-all',
                active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-sand-200 hover:ring-slate-300',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {config?.label ?? 'All'}
              <span className={clsx('text-xs', active ? 'text-slate-300' : 'text-slate-400')}>{counts[key] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {places.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="No places yet"
          description="Search the map and add the spots you’re excited about. Everyone can vote on them."
          action={
            <Button icon={MapPinPlus} onClick={() => setPlaceModal({})}>
              Add the first place
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className={clsx('space-y-3', view === 'map' && 'hidden lg:block')}>
            {visible.length === 0 && <EmptyState compact icon={Search} title="No places match" description="Try another category or search term." />}
            {visible.map((place) => (
              <div key={place.id} id={`place-${place.id}`}>
                <PlaceCard
                  place={place}
                  rank={rankOf[place.id]}
                  totals={totals[place.id]}
                  myVote={myVotes[place.id]}
                  addedBy={usersById[place.addedBy]}
                  scheduledDay={scheduledDayOf[place.id]}
                  canEdit={permissions.canEditPlace(place)}
                  canLock={permissions.canLockPlace}
                  onToggleLock={() =>
                    run(() => placeActions.setLock(place.id, !place.isLocked), place.isLocked ? `${place.name} unlocked.` : `${place.name} locked — only you can change it now.`)
                  }
                  votingOpen={voting.open}
                  selected={selectedId === place.id}
                  onSelect={() => setSelectedId(place.id)}
                  onVote={(value) => vote(place, value)}
                  onEdit={() => setPlaceModal({ place })}
                  onDelete={() => setDeleting(place)}
                  onSchedule={() => setScheduling(place)}
                />
              </div>
            ))}
          </div>
          <div className={clsx('lg:sticky lg:top-20 lg:self-start', view === 'list' && 'hidden lg:block')}>{mapPanel}</div>
        </div>
      )}

      <PlaceFormModal open={Boolean(placeModal)} onClose={() => setPlaceModal(null)} trip={trip} places={places} place={placeModal?.place} />
      <StopFormModal
        canLock={permissions.isLeader}
        open={Boolean(scheduling)}
        onClose={() => setScheduling(null)}
        trip={trip}
        places={places}
        placesById={Object.fromEntries(places.map((p) => [p.id, p]))}
        itinerary={itinerary}
        initial={{ placeId: scheduling?.id, dayId: itinerary.days[0]?.id }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Its votes are removed and it’s taken out of the itinerary for everyone."
        confirmLabel="Delete place"
        onConfirm={() => {
          const target = deleting
          run(() => placeActions.deletePlace(target.id), `${target.name} deleted.`)
        }}
      />
      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        tone="primary"
        title="Close voting now?"
        description="Every place with a positive score is locked in as a winner. You can reopen voting later."
        confirmLabel="Close voting"
        onConfirm={() => {
          const winners = ranked.filter((p) => (totals[p.id]?.score ?? 0) > 0 && !p.isLocked).map((p) => p.id)
          run(() => placeActions.closeVoting(winners), 'Voting closed — winners are locked.')
        }}
      />
    </div>
  )
}
