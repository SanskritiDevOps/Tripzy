import { useState } from 'react'
import clsx from 'clsx'
import { CalendarPlus, MapPin, PencilLine, Plus, Lock } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Combobox } from '../../components/ui/Combobox'
import { CategoryBadge, CategoryIcon } from '../../components/ui/Badge'
import { PLACE_CATEGORIES, PLACE_CATEGORY_KEYS } from '../../data/categories'
import { formatDate, formatDuration } from '../../utils/dates'
import { toInputValue, toMinor } from '../../utils/money'
import { nextSlot } from '../../utils/planner'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'
import { customPlaceDraft, searchNewPlaces } from '../places/placeSearch'

const DURATION_PRESETS = [30, 60, 90, 120, 180]

/**
 * Add a stop (`item` null) or edit one. `initial` can preset { dayId, placeId }.
 * Edits use optimistic versioning: if the stop changed since the modal opened,
 * the save is rejected and the latest version is loaded.
 */
export function StopFormModal({ open, onClose, ...props }) {
  return open ? <StopForm onClose={onClose} {...props} /> : null
}

function StopForm({ onClose, trip, places, placesById, itinerary, item = null, initial = {} }) {
  const addPlace = useTripzyStore((s) => s.addPlace)
  const addItineraryItem = useTripzyStore((s) => s.addItineraryItem)
  const updateItineraryItem = useTripzyStore((s) => s.updateItineraryItem)

  const isEdit = Boolean(item)
  const defaultDayId = item?.dayId ?? initial.dayId ?? itinerary.days[0]?.id
  const initialPlace = placesById[item?.placeId ?? initial.placeId] ?? null

  const [form, setForm] = useState(() => toForm(item, initialPlace, defaultDayId))
  const [selected, setSelected] = useState(initialPlace ? { kind: 'existing', place: initialPlace } : null)
  const [query, setQuery] = useState(initialPlace?.name ?? '')
  const [errors, setErrors] = useState({})
  const [version, setVersion] = useState(item?.version)

  function toForm(source, place, dayId) {
    const dayItems = itinerary.itemsByDay[dayId] ?? []
    return {
      dayId,
      startTime: source?.startTime ?? nextSlot(dayItems, placesById, place),
      duration: String(source?.durationMinutes ?? place?.durationMinutes ?? 60),
      cost: toInputValue(source?.costMinor ?? 0),
      notes: source?.notes ?? '',
      isLocked: source?.isLocked ?? false,
      category: 'sight',
    }
  }

  const update = (patch) => setForm((f) => ({ ...f, ...patch }))

  function choosePlace(choice) {
    setSelected(choice)
    setQuery(choice.place.name)
    setErrors((e) => ({ ...e, place: undefined }))
    const dayItems = (itinerary.itemsByDay[form.dayId] ?? []).filter((i) => i.id !== item?.id)
    update({
      duration: String(choice.place.durationMinutes ?? 60),
      ...(isEdit ? {} : { startTime: nextSlot(dayItems, placesById, choice.place) }),
    })
  }

  function getOptions(q) {
    const needle = q.trim().toLowerCase()
    const onBoard = places
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((place) => ({ kind: 'existing', place, key: place.id }))
    const fresh = searchNewPlaces(trip, places, q)
      .slice(0, 4)
      .map((place) => ({ kind: 'new', place, key: `new-${place.name}` }))
    return [...onBoard, ...fresh]
  }

  function validate() {
    const next = {}
    if (!selected) next.place = 'Choose a place from the board or search results'
    if (!form.startTime) next.startTime = 'Pick a start time'
    const duration = Number(form.duration)
    if (!Number.isInteger(duration) || duration < 5 || duration > 720) next.duration = 'Between 5 minutes and 12 hours'
    if (form.cost && Number.isNaN(toMinor(form.cost))) next.cost = 'Enter a valid amount'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function save(event) {
    event?.preventDefault()
    if (!validate()) return

    let placeId = selected.place.id
    if (selected.kind !== 'existing') {
      placeId = addPlace(trip.id, selected.place)
    }
    const payload = {
      dayId: form.dayId,
      placeId,
      startTime: form.startTime,
      durationMinutes: Number(form.duration),
      costMinor: form.cost ? toMinor(form.cost) : 0,
      notes: form.notes.trim(),
      isLocked: form.isLocked,
    }

    if (isEdit) {
      const result = updateItineraryItem(item.id, payload, version)
      if (result.conflict) {
        toast.error('Someone else just edited this stop. We loaded their latest version — review and save again.')
        setForm(toForm(result.current, placesById[result.current.placeId], result.current.dayId))
        setVersion(result.current.version)
        return
      }
      if (result.error) {
        toast.error(result.error)
        onClose()
        return
      }
      toast.success('Stop updated.')
    } else {
      addItineraryItem(form.dayId, payload)
      const day = itinerary.days.find((d) => d.id === form.dayId)
      toast.success(`${selected.place.name} added to Day ${day?.dayNumber}.`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={isEdit ? PencilLine : CalendarPlus}
      title={isEdit ? 'Edit stop' : 'Add a stop'}
      description={isEdit ? 'Changes sync to everyone planning this trip.' : 'Pick a place, then set when you’ll be there.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{isEdit ? 'Save stop' : 'Add to itinerary'}</Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-5" noValidate>
        <Field label="Place" error={errors.place}>
          <Combobox
            aria-label="Search places"
            value={query}
            onChange={(v) => {
              setQuery(v)
              if (selected && v !== selected.place.name) setSelected(null)
            }}
            icon={MapPin}
            placeholder="Search the places board or the map…"
            getKey={(o) => o.key}
            getOptions={getOptions}
            onSelect={choosePlace}
            emptyText="No places match — add it as a custom place below"
            renderOption={({ kind, place }) => (
              <div className="flex items-center gap-3">
                <CategoryIcon category={place.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{place.name}</p>
                  <p className="truncate text-xs text-slate-500">{place.address}</p>
                </div>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                    kind === 'existing' ? 'bg-sand-100 text-slate-500' : 'bg-ocean-50 text-ocean-700',
                  )}
                >
                  {kind === 'existing' ? 'On board' : 'Map result'}
                </span>
              </div>
            )}
            footer={(q, closeList) =>
              q.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    choosePlace({ kind: 'custom', place: customPlaceDraft(q, form.category, trip, places) })
                    closeList()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ocean-700 hover:bg-ocean-50"
                >
                  <Plus className="size-4" /> Add “{q.trim()}” as a custom place
                </button>
              )
            }
          />
        </Field>

        {selected && (
          <div className="flex items-center gap-3 rounded-2xl bg-sand-50 p-3 ring-1 ring-sand-200">
            <CategoryIcon category={selected.place.category} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{selected.place.name}</p>
              <p className="truncate text-xs text-slate-500">{selected.place.address}</p>
            </div>
            {selected.kind === 'existing' ? (
              <CategoryBadge category={selected.place.category} />
            ) : (
              <Select
                aria-label="Category"
                value={selected.place.category}
                onChange={(e) => setSelected({ ...selected, place: { ...selected.place, category: e.target.value } })}
                className="!h-9 w-32 text-xs"
              >
                {PLACE_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PLACE_CATEGORIES[key].label}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Day">
            {({ id }) => (
              <Select id={id} value={form.dayId} onChange={(e) => update({ dayId: e.target.value })}>
                {itinerary.days.map((d) => (
                  <option key={d.id} value={d.id}>
                    Day {d.dayNumber} · {formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Start time" error={errors.startTime}>
            {({ id, invalid }) => <Input id={id} type="time" step={300} value={form.startTime} invalid={invalid} onChange={(e) => update({ startTime: e.target.value })} />}
          </Field>
        </div>

        <Field label="Time to spend" error={errors.duration} hint={Number(form.duration) > 0 ? formatDuration(Number(form.duration)) : undefined}>
          {({ id, invalid }) => (
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-28">
                <Input id={id} type="number" min={5} max={720} step={5} value={form.duration} invalid={invalid} onChange={(e) => update({ duration: e.target.value })} />
              </div>
              <span className="text-sm text-slate-500">min</span>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update({ duration: String(m) })}
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors',
                      Number(form.duration) === m ? 'bg-ocean-700 text-white ring-ocean-700' : 'bg-white text-slate-600 ring-sand-200 hover:ring-ocean-300',
                    )}
                  >
                    {formatDuration(m)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estimated cost" optional hint="For the whole group" error={errors.cost}>
            {({ id, invalid }) => <Input id={id} inputMode="decimal" prefix="₹" placeholder="0" value={form.cost} invalid={invalid} onChange={(e) => update({ cost: e.target.value })} />}
          </Field>
          <div className="flex items-end pb-2.5">
            <Checkbox
              checked={form.isLocked}
              onChange={(e) => update({ isLocked: e.target.checked })}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5 text-slate-400" /> Lock this time slot
                </span>
              }
            />
          </div>
        </div>

        <Field label="Notes" optional>
          {({ id }) => <Textarea id={id} rows={2} placeholder="Booking refs, what to try, meeting point…" value={form.notes} onChange={(e) => update({ notes: e.target.value })} />}
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
