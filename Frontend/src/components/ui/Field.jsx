import { forwardRef, useId } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

const control =
  'w-full rounded-xl border-0 bg-white text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-sand-200 placeholder:text-slate-400 ' +
  'transition-shadow focus:outline-none focus:ring-2 focus:ring-ocean-500 disabled:bg-sand-50 disabled:text-slate-500'

/** Label + control + hint/error. Children receive the generated id via render prop or `id` passthrough. */
export function Field({ label, hint, error, optional, className, children, htmlFor }) {
  const generated = useId()
  const id = htmlFor ?? generated
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-slate-700">
          <span>{label}</span>
          {optional && <span className="text-xs font-normal text-slate-400">Optional</span>}
        </label>
      )}
      {typeof children === 'function' ? children({ id, invalid: Boolean(error) }) : children}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, icon: Icon, invalid, prefix, ...props }, ref) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />}
      {prefix && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-slate-500">{prefix}</span>
      )}
      <input
        ref={ref}
        className={clsx(control, 'h-11 px-3.5', (Icon || prefix) && 'pl-10', invalid && 'ring-red-400 focus:ring-red-500', className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(control, 'resize-y px-3.5 py-2.5', invalid && 'ring-red-400 focus:ring-red-500', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={clsx(control, 'h-11 appearance-none pr-10 pl-3.5', invalid && 'ring-red-400 focus:ring-red-500', className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
})

export function Checkbox({ checked, onChange, label, className, ...props }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-700', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 cursor-pointer rounded border-sand-300 text-ocean-600 accent-ocean-600"
        {...props}
      />
      {label}
    </label>
  )
}
