import clsx from 'clsx'

/** "Live" while other members' changes stream in; "Reconnecting…" while the socket is down. */
export function LiveIndicator({ live }) {
  return (
    <span
      role="status"
      title={live ? 'Changes from other members appear instantly' : 'Trying to reconnect — your changes still save'}
      className={clsx(
        'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:inline-flex',
        live ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200',
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
        <span className={clsx('relative inline-flex size-2 rounded-full', live ? 'bg-emerald-500' : 'bg-amber-500')} />
      </span>
      {live ? 'Live' : 'Reconnecting…'}
    </span>
  )
}
