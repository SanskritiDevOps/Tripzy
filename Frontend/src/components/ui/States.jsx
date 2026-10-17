import clsx from 'clsx'
import { Compass } from 'lucide-react'

export function EmptyState({ icon: Icon = Compass, title, description, action, className, compact = false }) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center rounded-2xl border border-dashed border-sand-300 bg-white/60 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-ocean-50 to-sand-100 text-ocean-600 ring-1 ring-ocean-100">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-xl bg-sand-200/70', className)} aria-hidden />
}

/** Placeholder shown while a lazily loaded tab's code downloads. */
export function PanelSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  )
}
