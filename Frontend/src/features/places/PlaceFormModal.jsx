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
import { usePlaceActions } from './usePlaceActions'
import { toast } from '../../store/useToastStore'
import { quickSuggestions, tripCenter, useMapSearch } from './placeSearch'
import { LocationPicker } from './LocationPicker'
import { MapSearchAction } from './MapSearchAction'

export function PlaceFormModal({ open, onClose, ...props }) {
  return open ? <PlaceForm onClose={onClose} {...props} /> : null
}

function PlaceForm({ onClose, trip, places, place = null, draft = null }) {
  const placeActions = usePlaceActions(trip)
  const [saving, setSaving] = useState(false)
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
  const mapSearch = useMapSearch(trip, places)
  const [pinSource, setPinSource] = useState(source?.lat != null ? 'saved' : null) // 'saved' | 'search' | 'pin'
  const location = form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : null

  async function save(event) {
    event?.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Give the place a name'
    const duration = Number(form.durationMinutes)
    if (!Number.isInteger(duration) || duration < 5 || duration > 720) next.durationMinutes = 'Between 5 and 720 minutes'
    if (!isEdit && places.some((p) => p.name.toLowerCase() === form.name.trim().toLowerCase())) next.name = 'This place is already on the board'
    // Real coordinates only: maps, route times and the AI planner depend on them.
    if (!location) next.location = 'Search the map or click it to drop a pin, so everyone sees the right spot'
    setErrors(next)
    if (Object.keys(next).length) return

    const payload = {
      name: form.name,
      address: form.address.trim(),
      lat: location.lat,
      lng: location.lng,
      category: form.category,
      durationMinutes: duration,
      notes: form.notes,
    }
    payload.name = payload.name.trim()
    payload.notes = payload.notes.trim()
    setSaving(true)
    try {
      if (isEdit) {
        await placeActions.updatePlace(place.id, payload)
        toast.success('Place updated.')
      } else {
        await placeActions.addPlace(payload)
        toast.success(`${payload.name} added to the board.`)
      }
      onClose()
    } catch (error) {
      // e.g. 403 "This place is locked by the team leader and cannot be modified."
      if (error.status !== 401) toast.error(error.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={isEdit ? PencilLine : MapPinPlus}
      title={isEdit ? 'Edit place' : 'Add a place'}
      description={isEdit ? undefined : 'Search the map, or name it yourself and drop a pin. Your group can vote on it right away.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {isEdit ? 'Save place' : 'Add to board'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        {!isEdit && (
          <Field label="Search the map" hint="Type a name and press Enter. Search by OpenStreetMap.">
            <Combobox
              aria-label="Search the map"
              value={query}
              onChange={setQuery}
              icon={Search}
              placeholder={`Search in ${trip.destination.split(',')[0]}…`}
              getKey={(p) => p.osmId ?? p.name}
              getOptions={(q) => [...quickSuggestions(trip, places, q), ...mapSearch.resultsFor(q)].slice(0, 10)}
              onSubmitQuery={mapSearch.search}
              onSelect={(p) => {
                setQuery('')
                setForm((f) => ({ ...f, name: p.name, address: p.address, lat: p.lat, lng: p.lng, category: p.category, durationMinutes: String(p.durationMinutes) }))
                setPinSource('search')
                setErrors({})
              }}
              footer={(q) => (
                <MapSearchAction
                  query={q}
                  status={mapSearch.statusFor(q)}
                  error={mapSearch.error}
                  onSearch={mapSearch.search}
                  emptyHint="Try another spelling, or fill in the name below and drop a pin."
                />
              )}
              emptyText={query.trim().length >= 2 ? 'Press Enter to search the map' : 'Type a place name'}
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

        <Field
          label="Location"
          error={errors.location}
          hint={
            pinSource === 'search'
              ? 'From OpenStreetMap. Drag the pin if it’s slightly off.'
              : location
                ? 'Drag the pin or click elsewhere to move it.'
                : 'Click the map where the place is.'
          }
        >
          <LocationPicker
            value={location}
            center={tripCenter(trip, places)}
            invalid={Boolean(errors.location)}
            className="h-56"
            onChange={(point) => {
              update({ lat: point.lat, lng: point.lng })
              setPinSource((s) => (s === 'search' ? 'search' : 'pin'))
              setErrors((e) => ({ ...e, location: undefined }))
            }}
          />
        </Field>

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
