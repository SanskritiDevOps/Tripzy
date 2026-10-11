import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, ArrowLeft, Bot, CalendarRange, Check, Lightbulb, Loader2, Lock, RefreshCcw, Route, Sparkles, ThumbsUp } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/Card'
import { CategoryIcon } from '../../components/ui/Badge'
import { itineraryApi } from '../../api/endpoints'
import { toast } from '../../store/useToastStore'
import { formatDate, formatDuration, formatTime, minutesToTime, timeToMinutes, weekday } from '../../utils/dates'
import { useTripActions } from '../trips/useTripActions'

const NOT_PLANNABLE = new Set(['stay', 'transit'])
const PACES = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'packed', label: 'Packed' },
]
const PACE_HINTS = {
  relaxed: 'Long breaks, about 2/3 of the day for activities.',
  balanced: 'Comfortable gaps between stops.',
  packed: 'Short gaps, the whole day used.',
}

/**
 * Plan days with AI (Gemini) or the route-based planner (README §4.6, §11).
 * Steps: setup (days, places + time at each, window, pace, notes) → generating →
 * preview → save. `preset` = { dayIds, mode: 'fill' | 'replace' }.
 */
export function PlannerModal({ open, onClose, ...props }) {
  return open ? <Planner onClose={onClose} {...props} /> : null
}

function Planner({ onClose, trip, places, placesById, itinerary, totals, ai, preset }) {
  const { itinerary: actions } = useTripActions(trip)
  const [step, setStep] = useState('setup') // 'setup' | 'loading' | 'preview'
  const [dayIds, setDayIds] = useState(() => new Set(preset?.dayIds ?? itinerary.days.map((d) => d.id)))
  const [mode, setMode] = useState(preset?.mode ?? 'fill')
  const [choice, setChoice] = useState({}) // placeId → checked (overrides the default)
  const [durations, setDurations] = useState({}) // placeId → minutes
  const [dayStart, setDayStart] = useState('09:00')
  const [dayEnd, setDayEnd] = useState('20:30')
  const [pace, setPace] = useState('balanced')
  const [notes, setNotes] = useState('')
  const [useAi, setUseAi] = useState(Boolean(ai?.enabled))
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const abortRef = useRef(null)

  const scoreOf = (place) => totals[place.id]?.score ?? 0

  // Which places can be planned: not already on another day, and not a stop that stays.
  const { eligible, keptCount, replacedCount, busyCount } = useMemo(() => {
    const lockedPlaces = new Set(places.filter((p) => p.isLocked).map((p) => p.id))
    const stays = (item) => mode === 'fill' || item.isLocked || lockedPlaces.has(item.placeId)
    const busy = new Set()
    let kept = 0
    let replaced = 0
    for (const day of itinerary.days) {
      for (const item of itinerary.itemsByDay[day.id]) {
        if (!dayIds.has(day.id)) busy.add(item.placeId)
        else if (stays(item)) {
          busy.add(item.placeId)
          kept += 1
        } else replaced += 1
      }
    }
    const list = places
      .filter((p) => !busy.has(p.id))
      .sort((a, b) => (totals[b.id]?.score ?? 0) - (totals[a.id]?.score ?? 0) || a.name.localeCompare(b.name))
    return { eligible: list, keptCount: kept, replacedCount: replaced, busyCount: places.length - list.length }
  }, [places, itinerary, dayIds, mode, totals])

  const isChecked = (place) => choice[place.id] ?? (!NOT_PLANNABLE.has(place.category) && scoreOf(place) >= 0)
  const durationOf = (place) => durations[place.id] ?? place.durationMinutes
  const selected = eligible.filter(isChecked)
  const selectedMinutes = selected.reduce((sum, p) => sum + (Number(durationOf(p)) || 0), 0)
  const windowMinutes = timeToMinutes(dayEnd) - timeToMinutes(dayStart)
  const orderedDayIds = itinerary.days.filter((d) => dayIds.has(d.id)).map((d) => d.id)

  function toggleDay(id) {
    setDayIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function validate() {
    if (dayIds.size === 0) return 'Pick at least one day.'
    if (selected.length === 0) return 'Pick at least one place to plan.'
    if (windowMinutes < 120) return 'The day must be at least 2 hours long.'
    const bad = selected.find((p) => !(Number(durationOf(p)) >= 5 && Number(durationOf(p)) <= 720))
    if (bad) return `Set a time between 5 and 720 minutes for ${bad.name}.`
    return ''
  }

  async function generate() {
    const problem = validate()
    setError(problem)
    if (problem) return
    setStep('loading')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await itineraryApi.generate(
        trip.id,
        {
          dayIds: orderedDayIds,
          mode,
          places: selected.map((p) => ({ placeId: p.id, durationMinutes: Number(durationOf(p)) })),
          dayStart,
          dayEnd,
          pace,
          notes: notes.trim(),
          engine: useAi ? 'auto' : 'code',
        },
        { signal: controller.signal },
      )
      setDraft(result)
      setStep('preview')
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.status === 401 ? '' : Object.values(err.details ?? {})[0] ?? err.message)
      setStep('setup')
    } finally {
      abortRef.current = null
    }
  }

  function cancelGenerating() {
    abortRef.current?.abort()
    setStep('setup')
  }

  function close() {
    abortRef.current?.abort()
    onClose()
  }

  const newStops = draft ? draft.days.reduce((sum, d) => sum + d.stops.filter((s) => !s.fixed).length, 0) : 0

  async function save() {
    setSaving(true)
    try {
      const added = await actions.savePlan(draft, { replaceDayIds: mode === 'replace' ? draft.days.map((d) => d.dayId) : [] })
      toast.success(`${added} ${added === 1 ? 'stop' : 'stops'} added to the itinerary${draft.engine === 'gemini' ? ' with AI tips' : ''}.`)
      onClose()
    } catch (err) {
      if (err.status !== 401) toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const footer =
    step === 'setup' ? (
      <>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button icon={useAi ? Sparkles : Route} onClick={generate} disabled={selected.length === 0 || dayIds.size === 0}>
          {useAi ? 'Plan with AI' : 'Plan by route'}
        </Button>
      </>
    ) : step === 'loading' ? (
      <Button variant="secondary" onClick={cancelGenerating}>
        Cancel
      </Button>
    ) : (
      <>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep('setup')} className="mr-auto">
          Adjust
        </Button>
        <Button variant="secondary" icon={RefreshCcw} onClick={generate} disabled={saving}>
          Try again
        </Button>
        <Button icon={Check} onClick={save} loading={saving} disabled={newStops === 0}>
          Save {newStops} {newStops === 1 ? 'stop' : 'stops'}
        </Button>
      </>
    )

  return (
    <Modal
      open
      onClose={close}
      size="lg"
      icon={Sparkles}
      title={step === 'preview' ? 'Review the plan' : 'Plan your days'}
      description={
        step === 'preview'
          ? 'Nothing is saved yet. Save it, then fine-tune by hand: drag, edit, lock.'
          : 'Pick days and places. Code handles distances and timing; AI handles order, meal times and tips.'
      }
      footer={footer}
    >
      {step === 'setup' && (
        <div className="space-y-6">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          {/* Days */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Days to plan</h3>
              <div className="flex gap-3 text-xs font-semibold text-ocean-700">
                <button type="button" onClick={() => setDayIds(new Set(itinerary.days.map((d) => d.id)))}>
                  All
                </button>
                <button type="button" onClick={() => setDayIds(new Set())}>
                  None
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Days to plan">
              {itinerary.days.map((day) => {
                const on = dayIds.has(day.id)
                return (
                  <button
                    key={day.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day.id)}
                    className={clsx(
                      'rounded-xl px-3 py-1.5 text-left text-xs font-semibold ring-1 transition-colors',
                      on ? 'bg-ocean-700 text-white ring-ocean-700' : 'bg-white text-slate-600 ring-sand-200 hover:ring-ocean-300',
                    )}
                  >
                    Day {day.dayNumber}
                    <span className={clsx('ml-1 font-normal', on ? 'text-ocean-100' : 'text-slate-400')}>
                      {weekday(day.date)} {formatDate(day.date, { day: 'numeric' })}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Mode */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Existing stops on those days</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                { value: 'fill', title: 'Keep them, fill the gaps', text: 'New stops are fitted around what’s already planned.' },
                { value: 'replace', title: 'Re-plan the rest', text: 'Unlocked stops are cleared and re-planned. Locked stops stay put.' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={clsx(
                    'flex cursor-pointer gap-3 rounded-2xl p-3 ring-1 transition-colors',
                    mode === option.value ? 'bg-ocean-50 ring-ocean-400' : 'bg-white ring-sand-200 hover:ring-ocean-300',
                  )}
                >
                  <input type="radio" name="plan-mode" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} className="mt-1 accent-ocean-600" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                    <span className="block text-xs text-slate-500">{option.text}</span>
                  </span>
                </label>
              ))}
            </div>
            {(keptCount > 0 || replacedCount > 0) && (
              <p className="mt-2 text-xs text-slate-500">
                {keptCount > 0 && `${keptCount} ${keptCount === 1 ? 'stop stays' : 'stops stay'} fixed`}
                {keptCount > 0 && replacedCount > 0 && ' · '}
                {replacedCount > 0 && <span className="font-semibold text-amber-700">{replacedCount} unlocked {replacedCount === 1 ? 'stop' : 'stops'} will be re-planned</span>}
              </p>
            )}
          </section>

          {/* Places */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Places and time at each</h3>
              <span className="text-xs text-slate-500">
                {selected.length} selected · {formatDuration(selectedMinutes)}
                {dayIds.size > 0 && ` of ~${formatDuration(dayIds.size * Math.max(windowMinutes, 0))} available`}
              </span>
            </div>
            {eligible.length === 0 ? (
              <p className="mt-2 rounded-xl bg-sand-50 px-3 py-3 text-sm text-slate-500">
                Every place is already scheduled. Add places on the Places tab, or choose “Re-plan the rest”.
              </p>
            ) : (
              <ul className="mt-2 max-h-72 divide-y divide-sand-100 overflow-y-auto rounded-2xl ring-1 ring-sand-200">
                {eligible.map((place) => {
                  const checked = isChecked(place)
                  return (
                    <li key={place.id} className={clsx('flex items-center gap-3 px-3 py-2', !checked && 'opacity-60')}>
                      <Checkbox checked={checked} onChange={(e) => setChoice((c) => ({ ...c, [place.id]: e.target.checked }))} aria-label={`Plan ${place.name}`} />
                      <CategoryIcon category={place.category} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{place.name}</span>
                        <span className={clsx('inline-flex items-center gap-1 text-xs', scoreOf(place) < 0 ? 'text-red-500' : 'text-slate-400')}>
                          <ThumbsUp className="size-3" /> {scoreOf(place)}
                        </span>
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500">
                        <input
                          type="number"
                          min={5}
                          max={720}
                          step={15}
                          value={durationOf(place)}
                          disabled={!checked}
                          onChange={(e) => setDurations((d) => ({ ...d, [place.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                          aria-label={`Minutes at ${place.name}`}
                          className="h-8 w-16 rounded-lg border-0 bg-white px-2 text-right text-sm text-slate-900 ring-1 ring-sand-200 ring-inset focus:ring-2 focus:ring-ocean-500 focus:outline-none disabled:bg-sand-50"
                        />
                        min
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {busyCount > 0 && <p className="mt-2 text-xs text-slate-400">{busyCount} already-scheduled {busyCount === 1 ? 'place is' : 'places are'} not shown.</p>}
          </section>

          {/* Day settings */}
          <section className="grid gap-4 sm:grid-cols-[1fr_1fr_1.6fr]">
            <Field label="Day starts">{({ id }) => <Input id={id} type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />}</Field>
            <Field label="Day ends">{({ id }) => <Input id={id} type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />}</Field>
            <Field label="Pace" hint={PACE_HINTS[pace]}>
              <SegmentedControl size="sm" aria-label="Pace" value={pace} onChange={setPace} options={PACES} className="w-full [&>button]:flex-1" />
            </Field>
          </section>

          <Field label="Anything the planner should know?" optional hint="Interests, diet, mobility, must-dos. Used by the AI.">
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. We love street food, one of us can’t walk long distances, sunset somewhere scenic"
              />
            )}
          </Field>

          {ai?.enabled ? (
            <div className="rounded-2xl bg-violet-50/70 p-3 ring-1 ring-violet-100">
              <Checkbox
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                label={
                  <span>
                    <span className="font-semibold text-violet-900">Use Gemini AI</span>{' '}
                    <span className="text-violet-700">for order, meal timing and tips</span>
                  </span>
                }
              />
              <p className="mt-1 pl-6.5 text-xs text-violet-600">Travel times and checks are done by Tripzy. Untick to use the route-based planner only.</p>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-2xl bg-sand-50 p-3 text-xs text-slate-500 ring-1 ring-sand-200">
              <Bot className="mt-0.5 size-4 shrink-0 text-slate-400" />
              Gemini AI isn’t configured on the server, so Tripzy’s route-based planner will group places by distance and time the stops.
            </p>
          )}
        </div>
      )}

      {step === 'loading' && (
        <div className="flex flex-col items-center py-10 text-center" role="status">
          <span className="grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <Loader2 className="size-7 animate-spin" aria-hidden />
          </span>
          <p className="mt-4 font-semibold text-slate-900">{useAi ? 'Planning with Gemini…' : 'Planning your days…'}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {useAi
              ? 'Grouping places by distance, asking Gemini for the best order, meal times and tips, then checking travel times. This can take up to half a minute.'
              : 'Grouping places by distance and fitting them into each day.'}
          </p>
        </div>
      )}

      {step === 'preview' && draft && <Preview draft={draft} placesById={placesById} mode={mode} />}
    </Modal>
  )
}

function Preview({ draft, placesById, mode }) {
  const nameOf = (id) => placesById[id]?.name ?? 'Removed place'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {draft.engine === 'gemini' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
            <Sparkles className="size-3.5" /> Planned by Gemini{draft.model ? ` · ${draft.model}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ocean-50 px-2.5 py-1 text-xs font-semibold text-ocean-700 ring-1 ring-ocean-200">
            <Route className="size-3.5" /> Route-based plan
          </span>
        )}
        <span className="text-xs text-slate-500">
          {draft.settings.dayStart}–{draft.settings.dayEnd} · {draft.settings.pace} pace
        </span>
      </div>
      {draft.notice && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {draft.notice}
        </p>
      )}

      {draft.days.map((day) => (
        <section key={day.dayId} className="rounded-2xl ring-1 ring-sand-200">
          <h3 className="flex items-center gap-2 border-b border-sand-100 px-4 py-2.5 text-sm font-semibold text-slate-900">
            <CalendarRange className="size-4 text-ocean-600" /> Day {day.dayNumber}
            <span className="font-normal text-slate-500">{formatDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </h3>
          {day.stops.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Nothing planned for this day.</p>
          ) : (
            <ol className="divide-y divide-sand-100">
              {day.stops.map((stop) => {
                const place = placesById[stop.placeId]
                const end = minutesToTime(timeToMinutes(stop.startTime) + stop.durationMinutes)
                return (
                  <li key={`${stop.placeId}-${stop.startTime}`} className={clsx('flex gap-3 px-4 py-2.5', stop.fixed && 'bg-sand-50/60')}>
                    <span className="w-16 shrink-0 pt-0.5 text-right text-xs">
                      <span className="block font-bold text-slate-900">{formatTime(stop.startTime)}</span>
                      <span className="text-slate-400">{formatTime(end)}</span>
                    </span>
                    <CategoryIcon category={place?.category ?? 'other'} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-800">
                        {nameOf(stop.placeId)}
                        {stop.fixed && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {mode === 'replace' && <Lock className="size-2.5" />} {mode === 'replace' ? 'Locked' : 'Already planned'}
                          </span>
                        )}
                        <span className="text-xs font-normal text-slate-400">{formatDuration(stop.durationMinutes)}</span>
                      </span>
                      {stop.tip && (
                        <span className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
                          <Lightbulb className="mt-px size-3 shrink-0 text-amber-500" /> {stop.tip}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      ))}

      {draft.unplaced.length > 0 && (
        <section className="rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-200">
          <h3 className="text-sm font-semibold text-amber-900">Didn’t fit ({draft.unplaced.length})</h3>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {draft.unplaced.map((u) => (
              <li key={u.placeId}>
                <span className="font-semibold">{nameOf(u.placeId)}</span> · {u.reason}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">Pick more days, a longer day or a faster pace, or add these by hand later.</p>
        </section>
      )}
      {draft.skipped.length > 0 && (
        <p className="text-xs text-slate-500">
          Skipped: {draft.skipped.map((s) => nameOf(s.placeId)).join(', ')} (already scheduled).
        </p>
      )}
    </div>
  )
}
