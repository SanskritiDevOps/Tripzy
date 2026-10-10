import { CalendarClock, Clock, Lock, Users, Wallet } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '../../components/ui/Avatar'
import { ProgressBar } from '../../components/ui/Card'
import { countdownLabel, formatDuration, formatTime, todayIso, tripStatus } from '../../utils/dates'
import { formatMoney } from '../../utils/money'

function Stat({ icon: Icon, label, aside, children, className }) {
  return (
    <div className={clsx('min-w-0 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-sand-200/80', className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <Icon className="size-3.5" aria-hidden /> {label}
        {aside && <span className="ml-auto">{aside}</span>}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** Countdown · budget vs spent · companions · next stop. */
export function TripSummaryBar({ trip, members, spentMinor, itinerary, placesById, permissions }) {
  const status = tripStatus(trip.startDate, trip.endDate)
  const over = trip.budgetMinor > 0 && spentMinor > trip.budgetMinor
  const online = members.filter((m) => m.online)

  const allItems = itinerary.days.flatMap((d) => itinerary.itemsByDay[d.id].map((i) => ({ ...i, date: d.date, dayNumber: d.dayNumber })))
  const plannedMinutes = allItems.reduce((sum, i) => sum + i.durationMinutes, 0)
  const today = todayIso()
  const next = allItems.find((i) => i.date >= today)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={CalendarClock} label={status.kind === 'upcoming' ? 'Countdown' : 'Status'}>
        {status.kind === 'upcoming' ? (
          <p className="font-display text-3xl font-semibold text-slate-900">
            {status.days}
            <span className="ml-1 text-sm font-sans font-medium text-slate-500">{status.days === 1 ? 'day' : 'days'} to go</span>
          </p>
        ) : (
          <p className="font-display text-xl font-semibold text-slate-900">{countdownLabel(trip.startDate, trip.endDate)}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          {itinerary.days.length} days · {formatDuration(plannedMinutes)} planned
        </p>
      </Stat>

      <Stat
        icon={Wallet}
        label="Budget"
        aside={
          permissions?.isMember && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-slate-600 normal-case">
              <Lock className="size-2.5" aria-hidden /> Set by Team Leader
            </span>
          )
        }
      >
        <p className="truncate font-display text-xl font-semibold text-slate-900">
          {formatMoney(spentMinor)}
          {trip.budgetMinor > 0 && <span className="ml-1 font-sans text-sm font-medium text-slate-400">/ {formatMoney(trip.budgetMinor)}</span>}
        </p>
        {trip.budgetMinor > 0 ? (
          <>
            <ProgressBar className="mt-2" value={spentMinor} max={trip.budgetMinor} tone={over ? 'danger' : 'ocean'} label="Budget used" />
            <p className={clsx('mt-1 text-xs', over ? 'font-semibold text-red-600' : 'text-slate-500')}>
              {over ? `${formatMoney(spentMinor - trip.budgetMinor)} over budget` : `${formatMoney(trip.budgetMinor - spentMinor)} left`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-500">No budget set</p>
        )}
      </Stat>

      <Stat icon={Users} label="Travellers">
        <div className="flex flex-wrap items-center gap-1.5">
          {members.slice(0, 6).map((m) => (
            <Avatar key={m.id} user={m} size="sm" online={m.online} />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-semibold text-emerald-600">{online.length} online</span> · {members.length} total
        </p>
      </Stat>

      <Stat icon={Clock} label="Next up">
        {next ? (
          <>
            <p className="truncate font-semibold text-slate-900">{placesById[next.placeId]?.name ?? 'Stop'}</p>
            <p className="mt-1 text-xs text-slate-500">
              Day {next.dayNumber} · {formatTime(next.startTime)}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">{status.kind === 'past' ? 'All done — hope it was great!' : 'Nothing scheduled yet'}</p>
        )}
      </Stat>
    </div>
  )
}
