import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin, Users } from 'lucide-react'
import { Combobox } from '../../components/ui/Combobox'
import { DateRangeField } from '../../components/ui/DateRangeField'
import { Select } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { DESTINATIONS } from '../../data/destinations'
import { GROUP_TYPES } from '../../data/categories'
import { addDays, daysBetween, todayIso } from '../../utils/dates'
import { useCurrentUser } from '../../store/selectors'
import { buildNewTripUrl } from '../../utils/urls'


export function HeroSearch({ destination, onDestinationChange }) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [dates, setDates] = useState(() => ({ start: addDays(todayIso(), 30), end: addDays(todayIso(), 33) }))
  const [group, setGroup] = useState('friends')
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    if (!destination.trim()) return setError('Where are you headed?')
    if (!dates.start || !dates.end || daysBetween(dates.start, dates.end) < 0) return setError('Pick valid travel dates.')
    setError('')
    const target = buildNewTripUrl({ destination: destination.trim(), start: dates.start, end: dates.end, group })
    navigate(user ? target : '/signup', { state: { from: target } })
  }

  return (
    <form
      onSubmit={submit}
      className="relative rounded-3xl bg-white/90 p-3 shadow-lift ring-1 ring-sand-200 backdrop-blur sm:p-4"
      aria-label="Start planning a trip"
    >
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1.4fr_0.9fr_auto] lg:items-end">
        <div className="space-y-1.5">
          <span className="pl-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Destination</span>
          <Combobox
            aria-label="Destination"
            value={destination}
            onChange={(v) => {
              onDestinationChange(v)
              setError('')
            }}
            icon={MapPin}
            placeholder="Jaipur, Kyoto, Goa…"
            inputClassName="h-12"
            getKey={(d) => d.id}
            getOptions={(q) =>
              DESTINATIONS.filter((d) => `${d.name} ${d.region}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
            }
            onSelect={(d) => onDestinationChange(`${d.name}, ${d.region.split(',')[0]}`)}
            emptyText="We’ll plan it anyway — just press Start planning"
            renderOption={(d) => (
              <div className="flex items-center gap-3">
                <span className="text-xl" aria-hidden>
                  {d.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                  <p className="truncate text-xs text-slate-500">{d.region}</p>
                </div>
                <span className="ml-auto hidden text-xs text-slate-400 sm:block">{d.bestTime}</span>
              </div>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <span className="pl-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">When</span>
          <DateRangeField label={null} start={dates.start} end={dates.end} min={todayIso()} onChange={setDates} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="hero-group" className="flex items-center gap-1 pl-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Users className="size-3" aria-hidden /> Who
          </label>
          <Select id="hero-group" value={group} onChange={(e) => setGroup(e.target.value)} className="h-12">
            {GROUP_TYPES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" size="lg" variant="accent" iconRight={ArrowRight} className="h-12 w-full lg:w-auto">
          Start planning
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 pl-1 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}
