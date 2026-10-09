import { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import { Search, X } from 'lucide-react'

/**
 * Accessible search dropdown.
 * - `getOptions(query)` returns the visible options (sync).
 * - `renderOption(option, { active })` renders a row.
 * - `onSelect(option)` fires on click / Enter.
 * - `footer(query)` optionally renders an extra action row (e.g. "Add custom place").
 */
export function Combobox({
  value,
  onChange,
  getOptions,
  renderOption,
  onSelect,
  getKey = (o) => o.id ?? o.name,
  placeholder = 'Search…',
  icon: Icon = Search,
  footer,
  emptyText = 'No matches found',
  className,
  inputClassName,
  autoFocus,
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()
  const options = open ? getOptions(value) : []

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function choose(option) {
    onSelect(option)
    setOpen(false)
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape') {
      if (open) event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={clsx(
          'h-11 w-full rounded-xl border-0 bg-white pr-9 pl-10 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-sand-200',
          'placeholder:text-slate-400 focus:ring-2 focus:ring-ocean-500 focus:outline-none',
          inputClassName,
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-sand-100 hover:text-slate-600"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && (
        <div
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-sand-200 animate-pop-in"
        >
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {options.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">{emptyText}</li>}
            {options.map((option, index) => (
              <li
                key={getKey(option)}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onPointerEnter={() => setActive(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                className={clsx('cursor-pointer rounded-xl px-3 py-2.5 transition-colors', index === active ? 'bg-ocean-50' : 'hover:bg-sand-50')}
              >
                {renderOption(option, { active: index === active })}
              </li>
            ))}
          </ul>
          {footer && (
            <div className="border-t border-sand-100 p-1.5" onPointerDown={(e) => e.preventDefault()}>
              {footer(value, () => setOpen(false))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
