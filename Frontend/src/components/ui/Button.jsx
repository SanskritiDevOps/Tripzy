import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-ocean-700 text-white shadow-sm hover:bg-ocean-800 active:bg-ocean-900 disabled:bg-ocean-700/50',
  accent: 'bg-coral-500 text-white shadow-sm hover:bg-coral-600 active:bg-coral-700 disabled:bg-coral-500/50',
  secondary:
    'bg-white text-slate-800 ring-1 ring-inset ring-sand-200 shadow-sm hover:bg-sand-50 hover:ring-sand-300 disabled:text-slate-400',
  ghost: 'text-slate-700 hover:bg-sand-100 active:bg-sand-200 disabled:text-slate-400',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-600/50',
  'danger-ghost': 'text-red-600 hover:bg-red-50 disabled:text-red-300',
}

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-2xl px-6 text-base',
}

const ICON_SIZES = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-12 rounded-2xl' }

/**
 * Pass `to` to render a router Link, `href` for an anchor, otherwise a <button>.
 * `icon` / `iconRight` take a Lucide component.
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading = false, to, href, className, children, disabled, ...props },
  ref,
) {
  const classes = clsx(
    'inline-flex shrink-0 select-none items-center justify-center font-semibold whitespace-nowrap transition-all duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-500 disabled:cursor-not-allowed',
    'active:scale-[0.98]',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
  const iconSize = size === 'lg' ? 'size-5' : 'size-4'
  const content = (
    <>
      {loading ? <Loader2 className={clsx(iconSize, 'animate-spin')} aria-hidden /> : Icon && <Icon className={iconSize} aria-hidden />}
      {children}
      {IconRight && <IconRight className={iconSize} aria-hidden />}
    </>
  )

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }
  return (
    <button ref={ref} type="button" className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  )
})

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center transition-all duration-150 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-500 disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        ICON_SIZES[size],
        className,
      )}
      {...props}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} aria-hidden />
    </button>
  )
})
