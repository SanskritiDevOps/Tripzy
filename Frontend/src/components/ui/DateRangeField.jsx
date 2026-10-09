import { useId } from 'react'
import clsx from 'clsx'
import { CalendarDays } from 'lucide-react'
import { daysBetween, tripLength } from '../../utils/dates'

/** Two native date inputs styled as one control, with a live "N days" summary. */
export function DateRangeField({ start, end, onChange, min, error, label = 'Dates', compact = false, className }) {
  const id = useId()
  const valid = start && end && daysBetween(start, end) >= 0
  const length = valid ? tripLength(start, end) : null

  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between text-sm font-medium text-slate-700">
          <label htmlFor={`${id}-start`}>{label}</label>
          {length && (
            <span className="text-xs font-semibold text-ocean-700">
              {length} {length === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>
      )}
      <div
        className={clsx(
          'flex items-center rounded-xl bg-white shadow-sm ring-1 ring-inset focus-within:ring-2 focus-within:ring-ocean-500',
          error ? 'ring-red-400' : 'ring-sand-200',
          compact ? 'h-11' : 'h-12',
        )}
      >
        <CalendarDays className="ml-3.5 size-4 shrink-0 text-slate-400" aria-hidden />
        <input
          id={`${id}-start`}
          type="date"
          aria-label="Start date"
          value={start}
          min={min}
          onChange={(e) => {
            const nextStart = e.target.value
            const nextEnd = end && nextStart && daysBetween(nextStart, end) < 0 ? nextStart : end
            onChange({ start: nextStart, end: nextEnd })
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-slate-900 focus:outline-none"
        />
        <span className="text-slate-300" aria-hidden>
          →
        </span>
        <input
          type="date"
          aria-label="End date"
          value={end}
          min={start || min}
          onChange={(e) => onChange({ start, end: e.target.value })}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-slate-900 focus:outline-none"
        />
      </div>
      {error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
