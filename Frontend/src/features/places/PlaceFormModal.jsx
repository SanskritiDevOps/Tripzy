import { useState } from 'react'
import clsx from 'clsx'
import { MapPinPlus, PencilLine, Search } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Combobox } from '../../components/ui/Combobox'
import { CategoryIcon } from '../../components/ui/Badge'
import { PLACE_CATEGORIES, PLACE_CATEGORY_KEYS } from '../../data/categories'
import { formatDuration } from '../../utils/dates'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'
import { customPlaceDraft, searchNewPlaces } from './placeSearch'

export function PlaceFormModal({ open, onClose, ...props }) {
  return open ? <PlaceForm onClose={onClose} {...props} /> : null
}

function PlaceForm({ onClose, trip, places, place = null, draft = null }) {
  const addPlace = useTripzyStore((s) => s.addPlace)
  const updatePlace = useTripzyStore((s) => s.updatePlace)
  const isEdit = Boolean(place)
  const source = place ?? draft

  const [query, setQuery] = useState('')
  const [form, setForm] = useState(() => ({
    name: source?.name ?? '',
    address: source?.address ?? '',
    lat: source?.lat ?? null,
    lng: source?.lng ?? null,
    category: source?.category ?? 'sight',
    durationMinutes: String(source?.durationMinutes ?? 60),
    notes: source?.notes ?? '',
  }))
  const [errors, setErrors] = useState({})
  const update = (patch) => setForm((f) => ({ ...f, ...patch }))

  function save(event) {
    event?.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Give the place a name'
    const duration = Number(form.durationMinutes)
    if (!Number.isInteger(duration) || duration < 5 || duration > 720) next.durationMinutes = 'Between 5 and 720 minutes'
    if (!isEdit && places.some((p) => p.name.toLowerCase() === form.name.trim().toLowerCase())) next.name = 'This place is already on the board'
    setErrors(next)
    if (Object.keys(next).length) return

    const located = form.lat == null ? customPlaceDraft(form.name, form.category, trip, places) : form
    const payload = {
      name: form.name,
      address: form.address || located.address,
      lat: located.lat,
      lng: located.lng,
      category: form.category,
      durationMinutes: duration,
      notes: form.notes,
    }
    if (isEdit) {
      updatePlace(place.id, { ...payload, name: payload.name.trim(), notes: payload.notes.trim() })
      toast.success('Place updated.')
    } else {
      addPlace(trip.id, payload)
      toast.success(`${payload.name.trim()} added to the board.`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={isEdit ? PencilLine : MapPinPlus}
      title={isEdit ? 'Edit place' : 'Add a place'}
      description={isEdit ? undefined : 'Search the map or type your own. Your group can vote on it right away.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{isEdit ? 'Save place' : 'Add to board'}</Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        {!isEdit && (
          <Field label="Search the map" hint="Results come from the destination’s map data.">
            <Combobox
              aria-label="Search the map"
              value={query}
              onChange={setQuery}
              icon={Search}
              placeholder={`Search in ${trip.destination.split(',')[0]}…`}
              getKey={(p) => p.name}
              getOptions={(q) => searchNewPlaces(trip, places, q)}
              onSelect={(p) => {
                setQuery('')
                setForm((f) => ({ ...f, ...p, durationMinutes: String(p.durationMinutes), notes: f.notes }))
                setErrors({})
              }}
              emptyText="No map results — fill in the details below instead"
              renderOption={(p) => (
                <div className="flex items-center gap-3">
                  <CategoryIcon category={p.category} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-slate-500">{p.address}</p>
                  </div>
                </div>
              )}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            {({ id, invalid }) => <Input id={id} value={form.name} invalid={invalid} placeholder="Hawa Mahal" onChange={(e) => update({ name: e.target.value })} />}
          </Field>
          <Field label="Address" optional>
            {({ id }) => <Input id={id} value={form.address} placeholder="Street, area" onChange={(e) => update({ address: e.target.value })} />}
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Category</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PLACE_CATEGORY_KEYS.map((key) => {
              const { label, icon: Icon } = PLACE_CATEGORIES[key]
              const active = form.category === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ category: key })}
                  className={clsx(
                    'flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-semibold ring-1 transition-all',
                    active ? 'bg-ocean-700 text-white ring-ocean-700 shadow-sm' : 'bg-white text-slate-600 ring-sand-200 hover:ring-ocean-300',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <Field label="Time to spend" error={errors.durationMinutes} hint={Number(form.durationMinutes) > 0 ? `About ${formatDuration(Number(form.durationMinutes))}` : undefined}>
          {({ id, invalid }) => (
            <div className="flex items-center gap-2">
              <div className="w-28">
                <Input id={id} type="number" min={5} max={720} step={15} value={form.durationMinutes} invalid={invalid} onChange={(e) => update({ durationMinutes: e.target.value })} />
              </div>
              <span className="text-sm text-slate-500">minutes</span>
            </div>
          )}
        </Field>

        <Field label="Notes" optional>
          {({ id }) => <Textarea id={id} rows={2} value={form.notes} placeholder="Why should the group go?" onChange={(e) => update({ notes: e.target.value })} />}
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
