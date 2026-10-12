import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, ChevronDown, Copy, Home, Luggage, RefreshCw, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { Button } from '../ui/Button'

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i
const RELOAD_MARK = 'tripzy:chunk-reload-at'

/** After a new deploy, an open tab can ask for code files that no longer exist. A reload fixes it. */
const isChunkLoadError = (error) => CHUNK_ERROR.test(String(error?.message ?? error))

/** Reloads once for a stale-code error; does nothing if we already tried in the last 30 s (avoids loops). */
function reloadOnceForChunkError() {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_MARK) || 0)
    if (Date.now() - last < 30_000) return
    window.sessionStorage.setItem(RELOAD_MARK, String(Date.now()))
  } catch {
    return // storage blocked: don't risk a reload loop
  }
  window.location.reload()
}

function errorReport(error, errorId) {
  return [
    `Error code: ${errorId}`,
    `Time: ${new Date().toISOString()}`,
    `Page: ${window.location.pathname}${window.location.search}`,
    `Message: ${error?.message ?? String(error)}`,
    `Browser: ${navigator.userAgent}`,
    ...(error?.stack ? ['', error.stack.split('\n').slice(0, 8).join('\n')] : []),
  ].join('\n')
}

/**
 * Friendly replacement for a crashed part of the app.
 * variant: 'app' (whole page, no router or navbar available),
 *          'page' (below the navbar), 'panel' (one tab inside a trip).
 */
export function ErrorScreen({ error, errorId, reset, variant = 'page' }) {
  const stale = isChunkLoadError(error)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (stale) reloadOnceForChunkError()
  }, [stale])

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(errorReport(error, errorId))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: details are still visible below */
    }
  }

  const title = stale ? 'Tripzy has been updated' : variant === 'panel' ? 'This tab ran into a problem' : 'Something went wrong'
  const message = stale
    ? 'A newer version is available. Reload to continue. Nothing you saved is lost.'
    : variant === 'panel'
      ? 'The rest of the trip still works. Try again, or switch to another tab. Everything you saved is safe.'
      : 'An unexpected error stopped this page from loading. Everything you saved is safe. Try again, or head back to your trips.'

  const card = (
    <div
      role="alert"
      className={clsx(
        'mx-auto w-full text-center',
        variant === 'panel' ? 'max-w-xl rounded-3xl bg-white px-6 py-10 shadow-soft ring-1 ring-sand-200' : 'max-w-lg px-4 py-16 sm:py-20',
      )}
    >
      <span className={clsx('mx-auto grid size-14 place-items-center rounded-2xl ring-1', stale ? 'bg-ocean-50 text-ocean-700 ring-ocean-100' : 'bg-coral-50 text-coral-600 ring-coral-100')}>
        {stale ? <Sparkles className="size-7" aria-hidden /> : <TriangleAlert className="size-7" aria-hidden />}
      </span>
      <h1 className={clsx('mt-5 font-display font-semibold text-slate-900', variant === 'panel' ? 'text-xl' : 'text-2xl sm:text-3xl')}>{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{message}</p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {stale ? (
          <Button icon={RefreshCw} onClick={() => window.location.reload()}>
            Reload Tripzy
          </Button>
        ) : (
          <>
            <Button icon={RotateCcw} onClick={reset}>
              Try again
            </Button>
            {variant === 'panel' ? (
              <Button variant="secondary" icon={RefreshCw} onClick={() => window.location.reload()}>
                Reload page
              </Button>
            ) : (
              <Button variant="secondary" icon={Luggage} href="/trips">
                Go to my trips
              </Button>
            )}
            {variant === 'app' && (
              <Button variant="ghost" icon={Home} href="/">
                Home
              </Button>
            )}
          </>
        )}
      </div>

      {!stale && (
        <details className="group mx-auto mt-8 max-w-md text-left">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600">
            Technical details <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 rounded-2xl bg-sand-50 p-3 ring-1 ring-sand-200">
            <p className="text-xs text-slate-500">
              Error code <span className="font-mono font-semibold text-slate-700">{errorId}</span>
            </p>
            <p className="mt-1 font-mono text-xs break-words text-slate-600">{error?.message ?? String(error)}</p>
            {import.meta.env.DEV && error?.stack && (
              <pre className="mt-2 max-h-40 overflow-auto font-mono text-[10px] leading-4 whitespace-pre-wrap text-slate-400">{error.stack}</pre>
            )}
            <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={copyDetails} className="mt-3 w-full">
              {copied ? 'Copied' : 'Copy error details'}
            </Button>
          </div>
        </details>
      )}
    </div>
  )

  if (variant !== 'app') return card

  // Whole-app fallback: the router and navbar may be what crashed, so it brings its own frame.
  return (
    <div className="flex min-h-dvh flex-col bg-sand-50">
      <header className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
        <a href="/" className="font-display text-xl font-semibold text-slate-900">
          Tripzy
        </a>
      </header>
      <main className="flex flex-1 items-center">{card}</main>
    </div>
  )
}
