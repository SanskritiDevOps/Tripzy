import clsx from 'clsx'

export function Card({ as: Tag = 'div', interactive = false, className, children, ...props }) {
  return (
    <Tag
      className={clsx(
        'rounded-2xl bg-white shadow-soft ring-1 ring-sand-200/80',
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:ring-sand-300',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, icon: Icon, action, className }) {
  return (
    <div className={clsx('flex items-start gap-3', className)}>
      {Icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand-100 text-ocean-700">
          <Icon className="size-[18px]" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ProgressBar({ value, max = 100, tone = 'ocean', className, label }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const tones = { ocean: 'bg-ocean-600', coral: 'bg-coral-500', danger: 'bg-red-500', success: 'bg-emerald-500' }
  return (
    <div
      className={clsx('h-2 overflow-hidden rounded-full bg-sand-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Pill-style segmented control. `options` = [{ value, label, icon?, count? }] */
export function SegmentedControl({ options, value, onChange, className, size = 'md', 'aria-label': ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={clsx('inline-flex rounded-xl bg-sand-100 p-1 ring-1 ring-sand-200/70', className)}>
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-all',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {option.label}
            {option.count != null && (
              <span className={clsx('rounded-full px-1.5 text-[10px]', selected ? 'bg-ocean-50 text-ocean-700' : 'bg-sand-200 text-slate-600')}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
