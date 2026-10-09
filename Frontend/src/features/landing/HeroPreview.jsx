import { ArrowUp, Camera, Lock, UtensilsCrossed, Wallet } from 'lucide-react'

/** A static collage of the product used as the hero illustration. */
export function HeroPreview() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-md select-none" aria-hidden>
      {/* Itinerary card */}
      <div className="absolute top-6 left-0 w-[86%] rotate-[-2deg] rounded-3xl bg-white p-5 shadow-lift ring-1 ring-sand-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-coral-600 uppercase">Day 2 · Sat</p>
            <p className="font-display text-lg font-semibold text-slate-900">Forts & palaces</p>
          </div>
          <div className="flex -space-x-2">
            {['bg-ocean-600', 'bg-coral-500', 'bg-violet-500'].map((c, i) => (
              <span key={c} className={`grid size-7 place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white ${c}`}>
                {['S', 'A', 'P'][i]}
              </span>
            ))}
          </div>
        </div>
        <ol className="mt-4 space-y-3">
          {[
            { time: '8:30', name: 'Amber Fort', icon: Camera, tone: 'bg-ocean-50 text-ocean-700', locked: true },
            { time: '12:00', name: 'Jal Mahal', icon: Camera, tone: 'bg-ocean-50 text-ocean-700' },
            { time: '13:15', name: 'Rawat Mishthan', icon: UtensilsCrossed, tone: 'bg-coral-50 text-coral-700' },
          ].map((stop) => (
            <li key={stop.name} className="flex items-center gap-3">
              <span className="w-11 text-right text-xs font-semibold text-slate-400">{stop.time}</span>
              <span className={`grid size-8 place-items-center rounded-lg ${stop.tone}`}>
                <stop.icon className="size-4" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{stop.name}</span>
              {stop.locked && <Lock className="ml-auto size-3.5 text-slate-400" />}
            </li>
          ))}
        </ol>
      </div>

      {/* Vote card */}
      <div className="absolute top-0 right-0 w-48 rotate-[4deg] rounded-2xl bg-white p-4 shadow-lift ring-1 ring-sand-200">
        <p className="text-xs font-semibold text-slate-500">Most popular</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">Nahargarh sunset</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
            <ArrowUp className="size-3" /> 4
          </span>
          <span className="text-xs text-slate-400">Priya voted just now</span>
        </div>
      </div>

      {/* Expense card */}
      <div className="absolute right-2 bottom-4 w-64 rotate-[2deg] rounded-2xl bg-ocean-800 p-4 text-white shadow-lift">
        <div className="flex items-center gap-2 text-ocean-200">
          <Wallet className="size-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">Settle up</span>
        </div>
        <p className="mt-2 text-sm">
          Rahul pays <span className="font-semibold">Aman</span>
        </p>
        <p className="font-display text-2xl font-semibold">₹1,200</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ocean-950/40">
          <div className="h-full w-2/3 rounded-full bg-coral-400" />
        </div>
        <p className="mt-1.5 text-[11px] text-ocean-200">₹78,400 of ₹1,20,000 budget used</p>
      </div>

      {/* Live badge */}
      <div className="absolute bottom-24 left-4 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft ring-1 ring-sand-200">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        3 planning live
      </div>
    </div>
  )
}
