import { Link } from 'react-router-dom'
import clsx from 'clsx'

function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ocean-700" />
      <circle cx="16" cy="16" r="9" fill="none" className="stroke-sand-50" strokeWidth="2" />
      <path d="M19.5 12.5 17.2 17.2 12.5 19.5 14.8 14.8Z" className="fill-coral-400" />
    </svg>
  )
}

export function Logo({ to = '/', light = false, className }) {
  return (
    <Link to={to} className={clsx('inline-flex items-center gap-2', className)} aria-label="Tripzy home">
      <LogoMark />
      <span className={clsx('font-display text-xl font-semibold tracking-tight', light ? 'text-white' : 'text-slate-900')}>Tripzy</span>
    </Link>
  )
}
