import { useState } from 'react'
import clsx from 'clsx'

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?'
}

/** Profile photo when the user has one (e.g. from Google), otherwise coloured initials. */
export function Avatar({ user, size = 'sm', online, ring = false, className }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const photo = user?.avatarUrl && user.avatarUrl !== failedUrl ? user.avatarUrl : null

  return (
    <span className={clsx('relative inline-flex shrink-0', className)} title={user?.name}>
      {photo ? (
        <img
          src={photo}
          alt=""
          // Google profile photos refuse requests that send a Referer.
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(photo)}
          className={clsx('rounded-full bg-sand-100 object-cover', SIZES[size], ring && 'ring-2 ring-white')}
        />
      ) : (
        <span
          className={clsx(
            'grid place-items-center rounded-full font-semibold text-white',
            user?.color ?? 'bg-slate-400',
            SIZES[size],
            ring && 'ring-2 ring-white',
          )}
        >
          {initials(user?.name)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={clsx(
            'absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-white',
            size === 'xs' ? 'size-2' : 'size-2.5',
            online ? 'bg-emerald-500' : 'bg-slate-300',
          )}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </span>
  )
}

export function AvatarStack({ users, max = 4, size = 'sm', showPresence = false }) {
  const visible = users.slice(0, max)
  const extra = users.length - visible.length
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <Avatar key={user.id} user={user} size={size} ring online={showPresence ? user.online : undefined} />
      ))}
      {extra > 0 && (
        <span className={clsx('grid place-items-center rounded-full bg-sand-200 font-semibold text-slate-600 ring-2 ring-white', SIZES[size])}>
          +{extra}
        </span>
      )}
    </div>
  )
}
