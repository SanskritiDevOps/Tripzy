import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

/**
 * Dialog that is a bottom sheet on phones and a centred card from `sm` up.
 * Closes on Escape and backdrop click, locks body scroll and restores focus.
 */
export function Modal({ open, onClose, title, description, icon: Icon, size = 'md', footer, children }) {
  const titleId = useId()
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusTimer = setTimeout(() => {
      const target = panelRef.current?.querySelector('[data-autofocus], input, select, textarea, button:not([data-close])')
      target?.focus()
    }, 30)

    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        const list = [...focusables].filter((el) => !el.disabled && el.offsetParent !== null)
        if (list.length === 0) return
        const first = list[0]
        const last = list.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-white shadow-lift',
          'rounded-t-3xl animate-sheet-up sm:rounded-3xl sm:animate-pop-in',
          SIZES[size],
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-sand-200 sm:hidden" aria-hidden />
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-6">
          {Icon && (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ocean-50 text-ocean-700 ring-1 ring-ocean-100">
              <Icon className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-2 grid size-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-sand-100 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-sand-100 bg-sand-50/60 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
