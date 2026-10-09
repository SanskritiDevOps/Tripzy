import { Activity, CalendarCheck2, CircleDollarSign, HandCoins, MapPinPlus, MapPinX, Sparkles, ThumbsDown, ThumbsUp, UserPlus, Vote } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/States'
import { formatMoney } from '../../utils/money'
import { relativeTime } from '../../utils/dates'

function describe(entry, usersById) {
  const p = entry.payload ?? {}
  switch (entry.type) {
    case 'PLACE_ADDED':
      return { icon: MapPinPlus, text: <>added <b>{p.name}</b></> }
    case 'PLACE_DELETED':
      return { icon: MapPinX, text: <>removed <b>{p.name}</b></> }
    case 'VOTED':
      return { icon: p.value > 0 ? ThumbsUp : ThumbsDown, text: <>{p.value > 0 ? 'upvoted' : 'downvoted'} <b>{p.name}</b></> }
    case 'VOTING_CLOSED':
      return { icon: Vote, text: <>closed voting and locked the winners</> }
    case 'EXPENSE_ADDED':
      return { icon: CircleDollarSign, text: <>paid <b>{formatMoney(p.amountMinor)}</b> for {p.title}</> }
    case 'EXPENSE_UPDATED':
      return { icon: CircleDollarSign, text: <>edited the expense <b>{p.title}</b></> }
    case 'EXPENSE_DELETED':
      return { icon: CircleDollarSign, text: <>deleted the expense <b>{p.title}</b></> }
    case 'SETTLED':
      return { icon: HandCoins, text: <>settled <b>{formatMoney(p.amountMinor)}</b> with {usersById[p.to]?.name.split(' ')[0] ?? 'a member'}</> }
    case 'ITINERARY_UPDATED':
      return { icon: CalendarCheck2, text: <>added <b>{p.name}</b> to Day {p.day}</> }
    case 'ITINERARY_GENERATED':
      return { icon: Sparkles, text: <>auto-planned <b>{p.count}</b> {p.count === 1 ? 'stop' : 'stops'}</> }
    case 'MEMBER_JOINED':
      return { icon: UserPlus, text: <>joined the trip</> }
    case 'MEMBER_LEFT':
      return { icon: UserPlus, text: <>updated the member list</> }
    case 'TRIP_CREATED':
      return { icon: Sparkles, text: <>created the trip</> }
    default:
      return { icon: Activity, text: <>updated the trip</> }
  }
}

export function ActivityFeed({ entries, usersById }) {
  if (entries.length === 0) {
    return <EmptyState compact icon={Activity} title="No activity yet" description="Changes from your group will appear here live." />
  }
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-sand-200">
      {entries.map((entry) => {
        const actor = usersById[entry.actorId]
        const { icon: Icon, text } = describe(entry, usersById)
        return (
          <li key={entry.id} className="relative flex gap-3">
            <Avatar user={actor} size="sm" className="ring-4 ring-white" />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{actor?.name.split(' ')[0] ?? 'Someone'}</span> {text}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <Icon className="size-3" aria-hidden /> {relativeTime(entry.createdAt)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
