import clsx from 'clsx'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore } from '../../store/useToastStore'

const TONES = {
  success: { icon: CheckCircle2, color: 'text-emerald-500' },
  error: { icon: XCircle, color: 'text-red-500' },
  info: { icon: Info, color: 'text-ocean-500' },
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
    >
      {toasts.map((t) => {
        const { icon: Icon, color } = TONES[t.tone] ?? TONES.info
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lift animate-sheet-up"
          >
            <Icon className={clsx('mt-0.5 size-4 shrink-0', color)} aria-hidden />
            <p className="flex-1">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
