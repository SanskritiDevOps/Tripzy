import { useEffect, useMemo } from 'react'
import clsx from 'clsx'
import {
  Activity,
  Backpack,
  CalendarCheck2,
  Check,
  CircleDollarSign,
  HandCoins,
  Loader2,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  MapPinPlus,
  Pencil,
  PlaneTakeoff,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserMinus,
  UserPlus,
  Vote,
  Wallet,
} from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState, Skeleton } from '../../components/ui/States'
import { EMPTY_FEED, useActivityStore } from '../../store/useActivityStore'
import { formatMoney } from '../../utils/money'
import { dayHeading, relativeTimeLong } from '../../utils/dates'

const FIELD_LABELS = { name: 'name', destination: 'destination', startDate: 'dates', endDate: 'dates', groupType: 'group type', currency: 'currency' }

/** Icon, colour and sentence (after the actor's name) for each action. */
function describe(action, d, usersById) {
  const place = <b className="font-semibold text-slate-900">{d.placeName ?? d.name}</b>
  switch (action) {
    case 'TRIP_CREATED':
      return { icon: PlaneTakeoff, tone: 'bg-ocean-50 text-ocean-700', text: <>created the trip</> }
    case 'TRIP_UPDATED': {
      const fields = [...new Set((d.fields ?? []).map((f) => FIELD_LABELS[f] ?? f))]
      return { icon: Settings2, tone: 'bg-slate-100 text-slate-600', text: <>updated the trip {fields.length ? fields.join(', ') : 'details'}</> }
    }
    case 'BUDGET_UPDATED':
      return {
        icon: Wallet,
        tone: 'bg-emerald-50 text-emerald-700',
        text: d.to ? <>set the trip budget to <b className="font-semibold text-slate-900">{formatMoney(d.to, d.currency)}</b></> : <>removed the trip budget</>,
      }
    case 'PLACE_ADDED':
      return { icon: MapPinPlus, tone: 'bg-ocean-50 text-ocean-700', text: <>added {place}</> }
    case 'PLACE_UPDATED':
      return { icon: Pencil, tone: 'bg-sky-50 text-sky-700', text: <>edited {place}</> }
    case 'PLACE_DELETED':
      return { icon: Trash2, tone: 'bg-red-50 text-red-600', text: <>removed {place}</> }
    case 'PLACE_LOCKED':
      return { icon: Lock, tone: 'bg-amber-50 text-amber-700', text: <>locked {place}</> }
    case 'PLACE_UNLOCKED':
      return { icon: LockOpen, tone: 'bg-amber-50 text-amber-700', text: <>unlocked {place}</> }
    case 'MEMBER_JOINED':
      return { icon: UserPlus, tone: 'bg-violet-50 text-violet-700', text: <>joined the trip</> }
    case 'MEMBER_LEFT':
      return { icon: LogOut, tone: 'bg-slate-100 text-slate-600', text: <>left the trip</> }
    case 'MEMBER_REMOVED':
      return { icon: UserMinus, tone: 'bg-slate-100 text-slate-600', text: <>removed <b className="font-semibold text-slate-900">{d.memberName ?? 'a member'}</b> from the trip</> }
    case 'INVITE_SENT':
      return { icon: Mail, tone: 'bg-violet-50 text-violet-700', text: <>invited <b className="font-semibold text-slate-900">{d.email}</b></> }
    case 'STOP_ADDED':
      return { icon: CalendarCheck2, tone: 'bg-sky-50 text-sky-700', text: <>added {place} to Day {d.dayNumber}</> }
    case 'STOP_UPDATED':
      return { icon: Pencil, tone: 'bg-sky-50 text-sky-700', text: <>updated {place} on Day {d.dayNumber}</> }
    case 'STOP_DELETED':
      return { icon: Trash2, tone: 'bg-red-50 text-red-600', text: <>removed {place} from Day {d.dayNumber}</> }
    case 'STOP_LOCKED':
      return { icon: Lock, tone: 'bg-amber-50 text-amber-700', text: <>locked the time slot for {place}</> }
    case 'STOP_UNLOCKED':
      return { icon: LockOpen, tone: 'bg-amber-50 text-amber-700', text: <>unlocked the time slot for {place}</> }
    case 'ITINERARY_REORDERED':
      return { icon: CalendarCheck2, tone: 'bg-sky-50 text-sky-700', text: <>reordered Day {d.dayNumber}</> }
    case 'VOTING_REOPENED':
      return { icon: Vote, tone: 'bg-emerald-50 text-emerald-700', text: <>reopened voting</> }
    case 'SETTLEMENT_RECORDED':
      return {
        icon: HandCoins,
        tone: 'bg-emerald-50 text-emerald-700',
        text: <>recorded that {d.fromName ?? usersById[d.fromUser]?.name} paid {d.toName ?? usersById[d.toUser]?.name} <b className="font-semibold text-slate-900">{formatMoney(d.amountMinor, d.currency)}</b></>,
      }
    case 'PACKING_ITEM_ADDED':
      return { icon: Backpack, tone: 'bg-violet-50 text-violet-700', text: <>added <b className="font-semibold text-slate-900">{d.label}</b> to the packing list</> }
    case 'PACKING_ITEM_DELETED':
      return { icon: Trash2, tone: 'bg-red-50 text-red-600', text: <>removed <b className="font-semibold text-slate-900">{d.label}</b> from the packing list</> }
    case 'PACKING_ITEM_PACKED':
      return { icon: Check, tone: 'bg-emerald-50 text-emerald-700', text: <>packed <b className="font-semibold text-slate-900">{d.label}</b></> }
    case 'PACKING_RESET':
      return { icon: RotateCcw, tone: 'bg-slate-100 text-slate-600', text: <>unchecked the whole packing list</> }
    case 'VOTED':
      return { icon: d.value > 0 ? ThumbsUp : ThumbsDown, tone: 'bg-emerald-50 text-emerald-700', text: <>{d.value > 0 ? 'upvoted' : 'downvoted'} {place}</> }
    case 'VOTING_CLOSED':
      return { icon: Vote, tone: 'bg-amber-50 text-amber-700', text: <>closed voting and locked the winners</> }
    case 'EXPENSE_ADDED':
      return { icon: CircleDollarSign, tone: 'bg-coral-50 text-coral-700', text: <>added <b className="font-semibold text-slate-900">{d.title}</b> ({formatMoney(d.amountMinor, d.currency)})</> }
    case 'EXPENSE_UPDATED':
      return { icon: CircleDollarSign, tone: 'bg-coral-50 text-coral-700', text: <>edited the expense <b className="font-semibold text-slate-900">{d.title}</b></> }
    case 'EXPENSE_DELETED':
      return { icon: Trash2, tone: 'bg-red-50 text-red-600', text: <>deleted the expense <b className="font-semibold text-slate-900">{d.title}</b></> }
    case 'SETTLED':
      return { icon: HandCoins, tone: 'bg-emerald-50 text-emerald-700', text: <>settled <b className="font-semibold text-slate-900">{formatMoney(d.amountMinor)}</b> with {usersById[d.to]?.name.split(' ')[0] ?? 'a member'}</> }
    case 'ITINERARY_UPDATED':
      return { icon: CalendarCheck2, tone: 'bg-sky-50 text-sky-700', text: <>added {place} to Day {d.day}</> }
    case 'ITINERARY_GENERATED':
      return {
        icon: Sparkles,
        tone: 'bg-violet-50 text-violet-700',
        text: (
          <>
            {d.engine === 'gemini' ? 'planned with AI' : 'auto-planned'} <b className="font-semibold text-slate-900">{d.count}</b> {d.count === 1 ? 'stop' : 'stops'}
            {d.dayNumber ? ` for Day ${d.dayNumber}` : d.dayCount ? ` across ${d.dayCount} days` : ''}
          </>
        ),
      }
    default:
      return { icon: Activity, tone: 'bg-slate-100 text-slate-600', text: <>updated the trip</> }
  }
}

function groupByDay(entries) {
  const groups = []
  for (const entry of entries) {
    const heading = dayHeading(entry.createdAt)
    if (groups.at(-1)?.heading !== heading) groups.push({ heading, entries: [] })
    groups.at(-1).entries.push(entry)
  }
  return groups
}

function Timeline({ entries, usersById, currentUserId }) {
  return (
    <div className="space-y-6">
      {groupByDay(entries).map((group) => (
        <section key={group.heading} aria-label={group.heading}>
          <h3 className="sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-1 text-xs font-semibold tracking-wide text-slate-400 uppercase backdrop-blur">{group.heading}</h3>
          <ol className="relative mt-2 space-y-4 before:absolute before:top-3 before:bottom-3 before:left-4 before:w-px before:bg-sand-200">
            {group.entries.map((entry) => {
              const actor = entry.user ? { ...usersById[entry.user.id], ...entry.user } : null
              const { icon: Icon, tone, text } = describe(entry.action, entry.details ?? {}, usersById)
              const actorName = actor ? (actor.id === currentUserId ? 'You' : actor.name) : 'A former member'
              return (
                <li key={entry.id} className="relative flex gap-3 animate-fade-in">
                  <span className="relative">
                    <Avatar user={actor ?? { name: '?' }} size="sm" className="ring-4 ring-white" />
                    <span className={clsx('absolute -right-1.5 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-white', tone)} aria-hidden>
                      <Icon className="size-3" />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{actorName}</span> {text}
                    </p>
                    <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString('en-IN')} className="mt-0.5 block text-xs text-slate-400">
                      {relativeTimeLong(entry.createdAt)}
                    </time>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading activity">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

const emptyState = <EmptyState compact icon={Activity} title="No activity yet. Start planning!" description="Places, locks, budget changes and new members will show up here." />

/** Server trips: the shared, persisted log from GET /api/trips/:id/activities. */
function RemoteActivityFeed({ trip, usersById, currentUserId }) {
  const feed = useActivityStore((s) => s.feeds[trip.id] ?? EMPTY_FEED)
  const load = useActivityStore((s) => s.load)
  const loadMore = useActivityStore((s) => s.loadMore)

  // Always fetch on open so other members' changes appear.
  useEffect(() => {
    load(trip.id)
  }, [trip.id, load])

  if (feed.status === 'idle' || feed.status === 'loading') return <FeedSkeleton />
  if (feed.status === 'error') {
    return (
      <EmptyState
        compact
        icon={Activity}
        title="Couldn’t load activity"
        description={feed.error}
        action={
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => load(trip.id)}>
            Try again
          </Button>
        }
      />
    )
  }
  if (feed.items.length === 0) return emptyState

  return (
    <div>
      {feed.status === 'refreshing' && (
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-400" role="status">
          <Loader2 className="size-3 animate-spin" /> Checking for updates…
        </p>
      )}
      <Timeline entries={feed.items} usersById={usersById} currentUserId={currentUserId} />
      {feed.nextCursor && (
        <div className="mt-6 text-center">
          <Button size="sm" variant="secondary" loading={feed.loadingMore} onClick={() => loadMore(trip.id)}>
            Show older activity
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Trip activity timeline. Trips saved on the server show the shared log from
 * the API; example trips show the activity recorded in this browser.
 */
export function ActivityFeed({ trip, localEntries, usersById, currentUserId }) {
  const normalizedLocal = useMemo(
    () =>
      localEntries.map((e) => ({
        id: e.id,
        action: e.type,
        details: e.payload,
        user: usersById[e.actorId] ? { id: e.actorId, name: usersById[e.actorId].name } : null,
        createdAt: e.createdAt,
      })),
    [localEntries, usersById],
  )

  if (trip.remote) return <RemoteActivityFeed trip={trip} usersById={usersById} currentUserId={currentUserId} />
  if (normalizedLocal.length === 0) return emptyState
  return <Timeline entries={normalizedLocal} usersById={usersById} currentUserId={currentUserId} />
}
