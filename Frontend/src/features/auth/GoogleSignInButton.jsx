import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAuthProviders } from './useAuthProviders'
import { useAuthStore } from '../../store/useAuthStore'
import { ApiError } from '../../api/client'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise = null

/** Loads Google Identity Services once per page. */
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Couldn’t load Google sign-in. Check your connection or ad-blocker.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * The official "Sign in with Google" button. Google returns an ID token
 * (`credential`) which the API verifies before creating or linking the account.
 * Renders nothing when the server hasn't enabled Google sign-in.
 */
export function GoogleSignInButton({ mode = 'login', onSuccess, onError }) {
  const { google } = useAuthProviders()
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const containerRef = useRef(null)
  const [state, setState] = useState('loading') // loading | ready | busy | unavailable
  // Latest callbacks without re-initialising Google on every render.
  const handlers = useRef({ onSuccess, onError })
  useEffect(() => {
    handlers.current = { onSuccess, onError }
  })

  const clientId = google?.clientId

  useEffect(() => {
    if (!clientId) return
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async ({ credential }) => {
            setState('busy')
            try {
              const user = await loginWithGoogle(credential)
              handlers.current.onSuccess?.(user)
            } catch (error) {
              setState('ready')
              handlers.current.onError?.(error instanceof ApiError ? error : new ApiError(0, { message: 'Google sign-in failed. Please try again.' }))
            }
          },
        })
        const width = Math.min(400, Math.max(220, Math.round(containerRef.current.getBoundingClientRect().width)))
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: mode === 'signup' ? 'signup_with' : 'continue_with',
          logo_alignment: 'center',
          width,
        })
        setState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setState('unavailable')
        handlers.current.onError?.(new ApiError(0, { message: error.message }))
      })

    return () => {
      cancelled = true
    }
  }, [clientId, mode, loginWithGoogle])

  if (!clientId) return null

  return (
    <div className="relative">
      {/* Google injects its own button (in an iframe) into this element. */}
      {/* Kept in the layout (just invisible) while loading so its width can be measured. */}
      <div
        ref={containerRef}
        className={clsx('flex min-h-11 justify-center', state === 'loading' && 'invisible absolute inset-x-0 top-0', state === 'unavailable' && 'hidden')}
      />
      {state === 'loading' && <div className="h-11 animate-pulse rounded-full bg-sand-100" aria-hidden />}
      {state === 'busy' && (
        <div className="absolute inset-0 grid place-items-center rounded-full bg-white/80 text-sm font-semibold text-slate-600" role="status">
          Signing you in…
        </div>
      )}
      {state === 'unavailable' && <p className="text-center text-xs text-slate-500">Google sign-in is unavailable right now.</p>}
    </div>
  )
}
