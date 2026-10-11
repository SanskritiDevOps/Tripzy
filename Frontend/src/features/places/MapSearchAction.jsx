import { AlertTriangle, Loader2, Search } from 'lucide-react'

/**
 * Footer row for place comboboxes: runs the OpenStreetMap search on demand and
 * shows its state. `extra` renders below (e.g. "Add with a pin").
 */
export function MapSearchAction({ query, status, error, onSearch, emptyHint = 'Try another spelling, or drop a pin instead.', extra }) {
  const q = query.trim()
  if (q.length < 2) return extra ?? null
  return (
    <div className="space-y-1">
      {status === 'loading' ? (
        <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500" role="status">
          <Loader2 className="size-4 animate-spin text-ocean-600" /> Searching OpenStreetMap…
        </p>
      ) : status === 'done' ? (
        <p className="px-3 py-1.5 text-[11px] text-slate-400">Map results © OpenStreetMap contributors</p>
      ) : (
        <button
          type="button"
          onClick={() => onSearch(q)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ocean-700 hover:bg-ocean-50"
        >
          <Search className="size-4" /> Search the map for “{q}”
          <span className="ml-auto text-[11px] font-normal text-slate-400">Enter</span>
        </button>
      )}
      {status === 'done-empty' && <p className="px-3 pb-1 text-xs text-slate-500">Nothing found on the map for “{q}”. {emptyHint}</p>}
      {status === 'error' && error && (
        <p className="flex items-start gap-1.5 px-3 pb-1 text-xs text-amber-700">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {error}
        </p>
      )}
      {extra}
    </div>
  )
}
