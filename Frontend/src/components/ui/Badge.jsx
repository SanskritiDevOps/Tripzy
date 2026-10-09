import clsx from 'clsx'
import { PLACE_CATEGORIES } from '../../data/categories'

const TONES = {
  neutral: 'bg-sand-100 text-slate-700 ring-sand-200',
  ocean: 'bg-ocean-50 text-ocean-700 ring-ocean-200',
  coral: 'bg-coral-50 text-coral-700 ring-coral-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  dark: 'bg-slate-900 text-white ring-slate-900',
}

export function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  )
}

export function CategoryBadge({ category, className, iconOnly = false }) {
  const config = PLACE_CATEGORIES[category] ?? PLACE_CATEGORIES.other
  const Icon = config.icon
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        iconOnly ? 'p-1' : 'px-2.5 py-0.5',
        config.badge,
        className,
      )}
      title={config.label}
    >
      <Icon className="size-3" aria-hidden />
      {!iconOnly && config.label}
    </span>
  )
}

/** Rounded square with a category icon — used as the leading visual in lists. */
export function CategoryIcon({ category, size = 'md', className }) {
  const config = PLACE_CATEGORIES[category] ?? PLACE_CATEGORIES.other
  const Icon = config.icon
  return (
    <span
      className={clsx(
        'grid shrink-0 place-items-center ring-1 ring-inset',
        size === 'sm' ? 'size-8 rounded-lg' : 'size-11 rounded-xl',
        config.badge,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} aria-hidden />
    </span>
  )
}
