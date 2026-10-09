import clsx from 'clsx'
import { ArrowUpRight, CalendarDays } from 'lucide-react'
import { formatMoneyCompact } from '../../utils/money'

export function DestinationCard({ destination, onSelect, className }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(destination)}
      className={clsx(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white text-left shadow-soft ring-1 ring-sand-200/80',
        'transition-all duration-200 hover:-translate-y-1 hover:shadow-lift',
        className,
      )}
    >
      <div className={clsx('relative h-36 overflow-hidden bg-gradient-to-br', destination.gradient)}>
        <div className="absolute -right-6 -bottom-8 size-36 rounded-full bg-white/20" />
        <div className="absolute top-6 -left-8 size-24 rounded-full bg-white/15" />
        <span className="absolute bottom-3 left-4 text-5xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110" aria-hidden>
          {destination.emoji}
        </span>
        <span className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-white/85 text-slate-700 opacity-0 transition-opacity group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">{destination.name}</h3>
          <span className="text-xs font-medium text-slate-400">{destination.region.split(',').at(-1).trim()}</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{destination.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {destination.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-sand-100 pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden /> {destination.bestTime}
          </span>
          <span>
            ~<span className="font-semibold text-slate-700">{formatMoneyCompact(destination.avgDailyMinor)}</span>/day
          </span>
        </div>
      </div>
    </button>
  )
}
