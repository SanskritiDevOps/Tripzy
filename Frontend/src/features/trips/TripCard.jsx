import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarDays, Crown, MapPin, Sparkles } from 'lucide-react'
import { AvatarStack } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/Card'
import { DESTINATIONS } from '../../data/destinations'
import { countdownLabel, formatDateRange, tripLength, tripStatus } from '../../utils/dates'
import { formatMoney } from '../../utils/money'

const FALLBACK = { gradient: 'from-ocean-400 via-ocean-200 to-sand-200', emoji: '🧭' }

/** `example`: one of the bundled example trips (shown with an "Example" badge, no leader crown). */
export function TripCard({ trip, members, placeCount, spentMinor, isLeader, example = false }) {
  const destination = DESTINATIONS.find((d) => d.id === trip.destinationId) ?? FALLBACK
  const status = tripStatus(trip.startDate, trip.endDate)
  const days = tripLength(trip.startDate, trip.endDate)

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-sand-200/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className={clsx('relative h-32 bg-gradient-to-br', destination.gradient, status.kind === 'past' && 'grayscale-[40%]')}>
        <div className="absolute -right-8 -bottom-10 size-40 rounded-full bg-white/20" aria-hidden />
        <span className="absolute bottom-3 left-4 text-4xl transition-transform duration-300 group-hover:scale-110" aria-hidden>
          {destination.emoji}
        </span>
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge tone={status.kind === 'upcoming' ? 'dark' : status.kind === 'ongoing' ? 'success' : 'neutral'} className="!ring-0">
            {countdownLabel(trip.startDate, trip.endDate)}
          </Badge>
          {example && (
            <Badge tone="neutral" icon={Sparkles} className="!bg-white/90 !text-violet-700 !ring-0">
              Example
            </Badge>
          )}
        </div>
        {isLeader && !example && (
          <span className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-white/85 text-amber-600" title="You’re the team leader">
            <Crown className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg leading-snug font-semibold group-hover:text-ocean-800">{trip.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{trip.destination}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden /> {formatDateRange(trip.startDate, trip.endDate)} · {days}d
        </p>

        {trip.budgetMinor > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-slate-500">Spent</span>
              <span className="font-semibold text-slate-700">
                {formatMoney(spentMinor)} <span className="font-normal text-slate-400">/ {formatMoney(trip.budgetMinor)}</span>
              </span>
            </div>
            <ProgressBar value={spentMinor} max={trip.budgetMinor} tone={spentMinor > trip.budgetMinor ? 'danger' : 'ocean'} label="Budget used" />
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-5">
          <AvatarStack users={members} size="xs" max={4} />
          <span className="text-xs font-medium text-slate-500">
            {placeCount} {placeCount === 1 ? 'place' : 'places'}
          </span>
        </div>
      </div>
    </Link>
  )
}
