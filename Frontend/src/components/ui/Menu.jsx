import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { MoreHorizontal } from 'lucide-react'
import { IconButton } from './Button'

/**
 * Small action menu. `items` = [{ label, icon, onClick, danger?, hidden? }].
 */
export function Menu({ items, label = 'More actions', icon = MoreHorizontal, align = 'right', size = 'sm', className }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const visible = items.filter((i) => !i.hidden)
  if (visible.length === 0) return null

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <IconButton
        icon={icon}
        label={label}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      />
      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute z-30 mt-1 min-w-48 rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-sand-200 animate-pop-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {visible.map(({ label: itemLabel, icon: Icon, onClick, danger }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onClick()
              }}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium',
                danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-sand-50',
              )}
            >
              {Icon && <Icon className={clsx('size-4', danger ? 'text-red-500' : 'text-slate-400')} aria-hidden />}
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
