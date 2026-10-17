import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, PlaneTakeoff, Settings2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Combobox } from '../../components/ui/Combobox'
import { DateRangeField } from '../../components/ui/DateRangeField'
import { DESTINATIONS, findDestination } from '../../data/destinations'
import { GROUP_TYPES } from '../../data/categories'
import { addDays, daysBetween, todayIso, tripLength } from '../../utils/dates'
import { toInputValue, toMinor } from '../../utils/money'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'
import { tripsApi } from '../../api/endpoints'
import { syncItinerary, syncTrips } from './remoteData'
import { ApiError } from '../../api/client'

const schema = z
  .object({
    name: z.string().trim().min(2, 'Give your trip a name').max(60, 'Keep it under 60 characters'),
    destination: z.string().trim().min(2, 'Where are you going?'),
    startDate: z.string().min(1, 'Pick a start date'),
    endDate: z.string().min(1, 'Pick an end date'),
    budget: z.string().refine((v) => v === '' || !Number.isNaN(toMinor(v)), 'Enter a valid amount'),
    groupType: z.string(),
  })
  .refine((v) => !v.startDate || !v.endDate || daysBetween(v.startDate, v.endDate) >= 0, {
    path: ['endDate'],
    message: 'The trip must end on or after the start date',
  })
  .refine((v) => !v.startDate || !v.endDate || tripLength(v.startDate, v.endDate) <= 30, {
    path: ['endDate'],
    message: 'Trips can be up to 30 days long',
  })

/** Create a trip (no `trip`) or edit an existing one (`trip` given). */
export function TripFormModal({ open, onClose, trip = null, prefill = {}, permissions }) {
  return open ? <TripForm onClose={onClose} trip={trip} prefill={prefill} permissions={permissions} /> : null
}

function TripForm({ onClose, trip, prefill, permissions }) {
  const navigate = useNavigate()
  const createTrip = useTripzyStore((s) => s.createTrip)
  const updateTrip = useTripzyStore((s) => s.updateTrip)
  const [destinationQuery, setDestinationQuery] = useState(trip?.destination ?? prefill.destination ?? '')
  const isEdit = Boolean(trip)
  // New trips: the creator becomes leader. Existing trips: only the leader sets the budget.
  const canSetBudget = !isEdit || Boolean(permissions?.canSetBudget)

  const start = trip?.startDate ?? prefill.start ?? addDays(todayIso(), 30)
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: trip?.name ?? (prefill.destination ? `${prefill.destination.split(',')[0]} trip` : ''),
      destination: trip?.destination ?? prefill.destination ?? '',
      startDate: start,
      endDate: trip?.endDate ?? prefill.end ?? addDays(start, 3),
      budget: trip ? toInputValue(trip.budgetMinor) : '',
      groupType: trip?.groupType ?? prefill.group ?? 'friends',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    const apiPayload = {
      name: values.name.trim(),
      destination: values.destination.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
      budgetMinor: values.budget ? toMinor(values.budget) : 0,
      groupType: values.groupType,
    }
    const localPayload = { ...apiPayload, destinationId: findDestination(values.destination)?.id ?? null }

    try {
      if (isEdit) {
        const { budgetMinor, ...details } = localPayload
        const budgetChanged = canSetBudget && budgetMinor !== trip.budgetMinor
        // Trips stored on the server are saved there first; example trips are local only.
        // Details and budget are separate endpoints: any member may edit details, only the leader the budget.
        const shrinking = tripLength(values.startDate, values.endDate) < tripLength(trip.startDate, trip.endDate)
        if (trip.remote) {
          const { name, destination, startDate, endDate, groupType } = apiPayload
          await tripsApi.update(trip.id, { name, destination, startDate, endDate, groupType })
          if (budgetChanged) await tripsApi.updateBudget(trip.id, budgetMinor)
          // The server owns the trip's days (new dates add or remove them with real ids) and
          // its map centre — reload both rather than rebuilding them in the browser.
          await Promise.all([syncTrips(), syncItinerary(trip.id)])
        } else {
          updateTrip(trip.id, budgetChanged ? localPayload : details)
        }
        toast.success(shrinking ? 'Trip updated. Days past the new end date were removed.' : 'Trip updated.')
        onClose()
      } else {
        // POST /api/trips requires a logged-in user; the server makes them the owner.
        const { trip: created } = await tripsApi.create(apiPayload)
        createTrip({ ...localPayload, id: created.id, remote: true })
        toast.success('Trip created! Invite your crew from the share button.')
        onClose()
        navigate(`/trips/${created.id}`)
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      if (error.status === 401) return // handled globally: session cleared, redirected to /login
      const fieldMap = { budgetMinor: 'budget' }
      const fieldErrors = Object.entries(error.details ?? {}).filter(([field]) => (fieldMap[field] ?? field) in getValues())
      fieldErrors.forEach(([field, message]) => setError(fieldMap[field] ?? field, { message }))
      if (fieldErrors.length === 0) toast.error(error.message)
    }
  })

  const [startDate, endDate] = useWatch({ control, name: ['startDate', 'endDate'] })

  return (
    <Modal
      open
      onClose={onClose}
      icon={isEdit ? Settings2 : PlaneTakeoff}
      title={isEdit ? 'Trip settings' : 'Plan a new trip'}
      description={isEdit ? 'Changes are visible to everyone in the trip.' : 'You can invite friends right after.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create trip'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Destination" error={errors.destination?.message}>
          <Controller
            control={control}
            name="destination"
            render={({ field }) => (
              <Combobox
                aria-label="Destination"
                value={destinationQuery}
                icon={MapPin}
                placeholder="Search a city or region"
                onChange={(v) => {
                  setDestinationQuery(v)
                  field.onChange(v)
                }}
                getKey={(d) => d.id}
                getOptions={(q) => DESTINATIONS.filter((d) => `${d.name} ${d.region}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)}
                onSelect={(d) => {
                  const label = `${d.name}, ${d.region.split(',')[0]}`
                  setDestinationQuery(label)
                  field.onChange(label)
                  if (!getValues('name')) setValue('name', `${d.name} trip`)
                }}
                emptyText="No suggestions — that’s fine, type any destination"
                renderOption={(d) => (
                  <div className="flex items-center gap-3">
                    <span className="text-lg" aria-hidden>
                      {d.emoji}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.region}</p>
                    </div>
                  </div>
                )}
              />
            )}
          />
        </Field>

        <Field label="Trip name" error={errors.name?.message}>
          {({ id, invalid }) => <Input id={id} placeholder="Jaipur Royal Weekend" invalid={invalid} {...register('name')} />}
        </Field>

        <DateRangeField
          start={startDate}
          end={endDate}
          min={isEdit ? undefined : todayIso()}
          error={errors.endDate?.message || errors.startDate?.message}
          onChange={({ start: s, end: e }) => {
            setValue('startDate', s, { shouldValidate: Boolean(errors.endDate) })
            setValue('endDate', e, { shouldValidate: Boolean(errors.endDate) })
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Total budget"
            optional={canSetBudget}
            hint={canSetBudget ? 'For the whole group' : 'Set by Team Leader'}
            error={errors.budget?.message}
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                inputMode="decimal"
                prefix="₹"
                placeholder="1,20,000"
                invalid={invalid}
                disabled={!canSetBudget}
                title={canSetBudget ? undefined : 'Only the team leader can change the budget'}
                {...register('budget')}
              />
            )}
          </Field>
          <Field label="Travelling as">
            {({ id }) => (
              <Select id={id} {...register('groupType')}>
                {GROUP_TYPES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
