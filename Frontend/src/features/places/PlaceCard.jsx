import clsx from 'clsx'
import { ArrowBigDown, ArrowBigUp, CalendarCheck2, CalendarPlus, Clock, Lock, LockOpen, Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { CategoryBadge, CategoryIcon } from '../../components/ui/Badge'
import { Menu } from '../../components/ui/Menu'
import { formatDuration, relativeTime } from '../../utils/dates'

/**
 * canEdit  → may edit/delete (false for members on locked places)
 * canLock  → team leader: shows the lock toggle
 */
export function PlaceCard({ place, rank, totals, myVote, addedBy, scheduledDay, canEdit, canLock, votingOpen, selected, onVote, onEdit, onDelete, onSchedule, onSelect, onToggleLock }) {
  const score = totals?.score ?? 0

  return (
    <article
      onClick={onSelect}
      className={clsx(
        'group relative flex gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 transition-all duration-200 hover:shadow-lift sm:gap-4',
        selected ? 'ring-2 ring-ocean-400' : 'ring-sand-200/80',
      )}
    >
      {/* Votes */}
      <div className="flex w-11 shrink-0 flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={`Upvote ${place.name}`}
          aria-pressed={myVote === 1}
          disabled={!votingOpen}
          onClick={() => onVote(1)}
          className={clsx(
            'grid size-9 place-items-center rounded-xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-50',
            myVote === 1 ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600',
          )}
        >
          <ArrowBigUp className="size-5" fill={myVote === 1 ? 'currentColor' : 'none'} />
        </button>
        <span
          className={clsx('text-sm font-bold tabular-nums', score > 0 ? 'text-emerald-600' : score < 0 ? 'text-red-500' : 'text-slate-400')}
          aria-label={`Score ${score}`}
          title={`${totals?.up ?? 0} up · ${totals?.down ?? 0} down`}
        >
          {score > 0 ? `+${score}` : score}
        </span>
        <button
          type="button"
          aria-label={`Downvote ${place.name}`}
          aria-pressed={myVote === -1}
          disabled={!votingOpen}
          onClick={() => onVote(-1)}
          className={clsx(
            'grid size-9 place-items-center rounded-xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-50',
            myVote === -1 ? 'bg-red-500 text-white shadow-sm' : 'text-slate-400 hover:bg-red-50 hover:text-red-500',
          )}
        >
          <ArrowBigDown className="size-5" fill={myVote === -1 ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <CategoryIcon category={place.category} className="hidden sm:grid" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {rank <= 3 && score > 0 && (
                <span
                  className={clsx(
                    'grid size-5 place-items-center rounded-full text-[10px] font-bold text-white',
                    rank === 1 ? 'bg-amber-500' : rank === 2 ? 'bg-slate-400' : 'bg-orange-400',
                  )}
                  title={`#${rank} most popular`}
                >
                  {rank}
                </span>
              )}
              <h3 className="truncate font-semibold text-slate-900">{place.name}</h3>
              {place.isLocked && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200"
                  title={canLock ? 'Locked — only you can edit or delete it' : 'Only the team leader can edit or delete this place'}
                >
                  <Lock className="size-2.5" /> Locked by Leader
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">{place.address}</p>
          </div>
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            {canLock && (
              <IconButton
                icon={place.isLocked ? Lock : LockOpen}
                label={place.isLocked ? `Unlock ${place.name}` : `Lock ${place.name}`}
                size="sm"
                aria-pressed={place.isLocked}
                onClick={onToggleLock}
                className={place.isLocked ? 'text-amber-700' : 'text-slate-400'}
              />
            )}
            <Menu
              items={[
                { label: scheduledDay ? `In Day ${scheduledDay}` : 'Add to itinerary', icon: CalendarPlus, onClick: onSchedule, hidden: Boolean(scheduledDay) },
                { label: 'Edit place', icon: Pencil, onClick: onEdit, hidden: !canEdit },
                { label: 'Delete place', icon: Trash2, onClick: onDelete, hidden: !canEdit, danger: true },
              ]}
            />
          </div>
        </div>

        {place.notes && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{place.notes}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
          <CategoryBadge category={place.category} />
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {formatDuration(place.durationMinutes)}
          </span>
          {scheduledDay ? (
            <span className="inline-flex items-center gap-1 font-semibold text-ocean-700">
              <CalendarCheck2 className="size-3" /> Day {scheduledDay}
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSchedule()
              }}
              className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-ocean-700"
            >
              <CalendarPlus className="size-3" /> Schedule
            </button>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Avatar user={addedBy} size="xs" />
            <span className="hidden sm:inline">{addedBy?.name.split(' ')[0]} ·</span> {relativeTime(place.createdAt)}
          </span>
        </div>
      </div>
    </article>
  )
}
