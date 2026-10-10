import { useMemo } from 'react'
import clsx from 'clsx'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from './dndModifiers'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, ArrowDown, ArrowUp, Car, GripVertical, Lock, LockOpen, NotebookPen, Pencil, Sparkles, Trash2, Wallet } from 'lucide-react'
import { CategoryIcon } from '../../components/ui/Badge'
import { IconButton } from '../../components/ui/Button'
import { Menu } from '../../components/ui/Menu'
import { formatDuration, formatTime, minutesToTime, timeToMinutes } from '../../utils/dates'
import { estimateTravelMinutes } from '../../utils/geo'
import { formatMoney } from '../../utils/money'
import { findOverlaps } from '../../utils/planner'
import { PLACE_CATEGORIES } from '../../data/categories'

/**
 * canLock            → team leader: may lock/unlock time slots
 * canEditStop(i, p)  → false for members on locked stops or stops of locked places
 */
export function DayTimeline({ items, placesById, onReorder, onEdit, onDelete, onToggleLock, canLock = true, canEditStop = () => true }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const overlaps = useMemo(() => findOverlaps(items), [items])
  const ids = items.map((i) => i.id)

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id)
    const to = ids.indexOf(over.id)
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="relative">
          {items.map((item, index) => {
            const next = items[index + 1]
            const place = placesById[item.placeId]
            const nextPlace = next && placesById[next.placeId]
            return (
              <li key={item.id}>
                <SortableStop
                  item={item}
                  place={place}
                  overlap={overlaps.has(item.id)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                  onToggleLock={() => onToggleLock(item)}
                  canLock={canLock}
                  editable={canEditStop(item, place)}
                  onMoveUp={index > 0 ? () => onReorder(arrayMove(ids, index, index - 1)) : null}
                  onMoveDown={next ? () => onReorder(arrayMove(ids, index, index + 1)) : null}
                />
                {next && <TravelGap from={place} to={nextPlace} item={item} next={next} />}
              </li>
            )
          })}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function TravelGap({ from, to, item, next }) {
  const travel = from && to ? estimateTravelMinutes(from, to) : null
  const end = timeToMinutes(item.startTime) + item.durationMinutes
  const free = timeToMinutes(next.startTime) - end - (travel ?? 0)
  return (
    <div className="flex items-center gap-3 py-1.5 pl-[4.25rem] sm:pl-[5.25rem]" aria-hidden>
      <span className="h-6 w-px border-l-2 border-dotted border-sand-300" />
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <Car className="size-3" /> ~{formatDuration(travel ?? 0)}
        {free >= 20 && <span className="text-emerald-600">· {formatDuration(free)} free</span>}
      </span>
    </div>
  )
}

function SortableStop({ item, place, overlap, onEdit, onDelete, onToggleLock, onMoveUp, onMoveDown, canLock, editable }) {
  const fixed = item.isLocked || !editable
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: fixed,
  })
  const category = place?.category ?? 'other'
  const endTime = minutesToTime(timeToMinutes(item.startTime) + item.durationMinutes)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx('relative flex gap-3 sm:gap-4', isDragging && 'z-10')}
    >
      <div className="w-14 shrink-0 pt-4 text-right sm:w-[4.25rem]">
        <p className="text-sm font-bold text-slate-900">{formatTime(item.startTime).replace(' ', ' ')}</p>
        <p className="text-[11px] text-slate-400">{formatTime(endTime)}</p>
      </div>

      <div
        className={clsx(
          'group relative min-w-0 flex-1 rounded-2xl bg-white p-3 pr-2 shadow-soft ring-1 transition-shadow sm:p-4 sm:pr-3',
          isDragging ? 'shadow-lift ring-ocean-300' : 'ring-sand-200/80 hover:shadow-lift',
          overlap && 'ring-amber-300',
        )}
      >
        <span className={clsx('absolute inset-y-3 left-0 w-1 rounded-r-full', PLACE_CATEGORIES[category].dot)} aria-hidden />
        <div className="flex items-start gap-3">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            disabled={fixed}
            aria-label={fixed ? `${place?.name} is locked` : `Drag to reorder ${place?.name}`}
            className={clsx(
              'mt-2 -ml-1 touch-none rounded-md p-0.5 text-slate-300',
              fixed ? 'cursor-not-allowed' : 'cursor-grab hover:text-slate-500 active:cursor-grabbing',
            )}
          >
            <GripVertical className="size-4" />
          </button>
          <CategoryIcon category={category} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="truncate font-semibold text-slate-900">{place?.name ?? 'Removed place'}</h4>
              {item.source === 'AI' && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700" title="Added by auto-plan">
                  <Sparkles className="size-2.5" /> Auto
                </span>
              )}
              {item.isLocked && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  <Lock className="size-2.5" /> {canLock ? 'Locked' : 'Locked by Leader'}
                </span>
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span>{formatDuration(item.durationMinutes)}</span>
              {item.costMinor > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="size-3" /> {formatMoney(item.costMinor)}
                </span>
              )}
              {place?.address && <span className="hidden truncate md:inline">{place.address}</span>}
            </p>
            {item.notes && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sand-50 px-2.5 py-1.5 text-xs text-slate-600">
                <NotebookPen className="mt-px size-3 shrink-0 text-slate-400" /> {item.notes}
              </p>
            )}
            {overlap && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                <AlertTriangle className="size-3" /> Starts before the previous stop ends
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            {canLock && (
              <IconButton
                icon={item.isLocked ? Lock : LockOpen}
                label={item.isLocked ? 'Unlock time slot' : 'Lock time slot'}
                size="sm"
                onClick={onToggleLock}
                className={clsx(item.isLocked ? 'text-slate-700' : 'text-slate-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100')}
              />
            )}
            <Menu
              items={[
                { label: 'Edit stop', icon: Pencil, onClick: onEdit, hidden: !editable },
                { label: 'Move up', icon: ArrowUp, onClick: onMoveUp, hidden: !onMoveUp || fixed },
                { label: 'Move down', icon: ArrowDown, onClick: onMoveDown, hidden: !onMoveDown || fixed },
                { label: 'Remove from day', icon: Trash2, onClick: onDelete, danger: true, hidden: !editable },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
