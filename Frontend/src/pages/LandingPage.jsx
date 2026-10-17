import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarRange,
  Map as MapIcon,
  MapPin,
  Plane,
  Radio,
  Sparkles,
  ThumbsUp,
  Wallet,
  Backpack,
  Link2,
  Vote,
} from 'lucide-react'
import { HeroSearch } from '../features/landing/HeroSearch'
import { buildNewTripUrl, loginPath } from '../utils/urls'
import { HeroPreview } from '../features/landing/HeroPreview'
import { DestinationCard } from '../features/landing/DestinationCard'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/layout/Logo'
import { DESTINATIONS } from '../data/destinations'
import { useAuthStore } from '../store/useAuthStore'
import { addDays, todayIso } from '../utils/dates'

const FEATURES = [
  { icon: MapPin, title: 'Shared places board', body: 'Search the map, drop pins and see who suggested what — all in one list.', tone: 'bg-ocean-50 text-ocean-700' },
  { icon: Vote, title: 'Vote, don’t argue', body: 'Up- or down-vote every idea. A live “Most popular” list settles the debate.', tone: 'bg-emerald-50 text-emerald-700' },
  { icon: CalendarRange, title: 'Day-by-day itinerary', body: 'Drag stops into days, set times, lock must-dos — or let auto-plan draft it.', tone: 'bg-amber-50 text-amber-800' },
  { icon: Wallet, title: 'Split expenses fairly', body: 'Equal, exact or percentage splits, with the fewest payments to settle up.', tone: 'bg-coral-50 text-coral-700' },
  { icon: Radio, title: 'Live for everyone', body: 'Votes, stops and expenses appear instantly for the whole group.', tone: 'bg-sky-50 text-sky-700' },
  { icon: Backpack, title: 'Packing checklist', body: 'A shared list so nobody forgets the charger (again).', tone: 'bg-violet-50 text-violet-700' },
]

const STEPS = [
  { icon: Link2, title: 'Create & invite', body: 'Start a trip and share a link with your group.' },
  { icon: ThumbsUp, title: 'Collect & vote', body: 'Everyone adds places; the best ideas rise to the top.' },
  { icon: Plane, title: 'Plan & go', body: 'Build the itinerary, track spend and settle up after.' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [destination, setDestination] = useState('')
  const trending = DESTINATIONS.filter((d) => d.trending)

  function startWith(dest) {
    const target = buildNewTripUrl({
      destination: `${dest.name}, ${dest.region.split(',')[0]}`,
      start: addDays(todayIso(), 30),
      end: addDays(todayIso(), 33),
      group: 'friends',
    })
    navigate(user ? target : loginPath(target))
  }

  return (
    <div className="-mt-16">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ocean-50 via-sand-50 to-sand-50 pt-16">
        <div className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full bg-coral-200/40 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute top-40 -left-32 size-[24rem] rounded-full bg-ocean-200/50 blur-3xl" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:pb-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ocean-800 shadow-sm ring-1 ring-ocean-100">
              <Sparkles className="size-3.5 text-coral-500" aria-hidden />
              Group trips, finally in sync
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Plan the trip together,
              <br className="hidden sm:block" /> <span className="text-ocean-700">not in five group chats.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
              Tripzy puts places, votes, the itinerary and the shared budget in one live workspace — so everyone sees the same plan,
              all the time.
            </p>
          </div>
          <div className="hidden lg:block">
            <HeroPreview />
          </div>
          <div className="lg:col-span-2 lg:-mt-6">
            <HeroSearch destination={destination} onDestinationChange={setDestination} />
            <p className="mt-3 pl-1 text-xs text-slate-500">
              Popular right now:{' '}
              {trending.slice(0, 4).map((d, i) => (
                <span key={d.id}>
                  <button type="button" className="font-semibold text-ocean-700 hover:underline" onClick={() => setDestination(`${d.name}, ${d.region.split(',')[0]}`)}>
                    {d.name}
                  </button>
                  {i < 3 && ', '}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="trending-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-coral-600">Trending destinations</p>
            <h2 id="trending-heading" className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
              Where groups are heading
            </h2>
          </div>
          <p className="max-w-sm text-sm text-slate-500">Tap a destination to start a trip with sensible dates — you can change everything later.</p>
        </div>
        <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-6">
          {trending.map((d) => (
            <DestinationCard key={d.id} destination={d} onSelect={startWith} className="w-64 shrink-0 snap-start sm:w-auto" />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16 sm:py-20" aria-labelledby="features-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-coral-600">Everything in one place</p>
            <h2 id="features-heading" className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
              Replace the polls, spreadsheets and scattered notes
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, tone }) => (
              <div
                key={title}
                className="group rounded-2xl bg-sand-50 p-6 ring-1 ring-sand-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lift"
              >
                <span className={`grid size-11 place-items-center rounded-xl ${tone} transition-transform group-hover:scale-105`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
          From “we should go somewhere” to boarding
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-2xl bg-white p-6 text-center shadow-soft ring-1 ring-sand-200/80">
              <span className="absolute top-4 left-4 font-display text-sm font-semibold text-sand-400">0{i + 1}</span>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ocean-700 text-white shadow-sm">
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ocean-800 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-coral-400/25 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-ocean-400/30 blur-2xl" aria-hidden />
          <MapIcon className="mx-auto size-10 text-ocean-200" aria-hidden />
          <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">Your next trip starts with one link</h2>
          <p className="mx-auto mt-3 max-w-lg text-ocean-100">Create a trip in under a minute and invite your crew. It’s free.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="accent" iconRight={ArrowRight} to={user ? '/trips?new=1' : loginPath('/trips?new=1', '/signup')}>
              {user ? 'Create a trip' : 'Get started free'}
            </Button>
            {user && (
              <Button size="lg" variant="secondary" to="/trips">
                Open my trips
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-sand-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <p>Plan trips together · © {new Date().getFullYear()} Tripzy</p>
        </div>
      </footer>
    </div>
  )
}
