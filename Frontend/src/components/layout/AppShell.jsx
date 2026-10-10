import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Navbar } from './Navbar'
import { Toaster } from '../ui/Toaster'
import { useAuthStore } from '../../store/useAuthStore'
import { configureApi } from '../../api/client'
import { toast } from '../../store/useToastStore'
import { loginPath } from '../../utils/urls'

/**
 * Restores the session on first load and handles 401s from any API call:
 * stale auth state is cleared and the user is sent to /login?redirect=<here>.
 */
function AuthBridge() {
  const navigate = useNavigate()
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    configureApi({
      onUnauthorized: () => {
        const wasSignedIn = useAuthStore.getState().status === 'authenticated'
        useAuthStore.getState().clearSession()
        if (wasSignedIn) toast.info('Your session expired. Please log in again.')
        const { pathname, search } = window.location
        if (pathname !== '/login' && pathname !== '/signup') navigate(loginPath(pathname + search), { replace: true })
      },
    })
  }, [navigate])

  return null
}

export function AppShell() {
  const { pathname } = useLocation()
  const transparent = pathname === '/'
  return (
    <div className="flex min-h-dvh flex-col">
      <AuthBridge />
      <Navbar transparent={transparent} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}

export function FullPageLoader({ label = 'Loading' }) {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
        <Loader2 className="size-5 animate-spin text-ocean-600" aria-hidden /> {label}…
      </span>
    </div>
  )
}

/** Waits for the session check, then redirects anonymous users to /login?redirect=<here>. */
export function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'unknown') return <FullPageLoader label="Checking your session" />
  if (status !== 'authenticated') return <Navigate to={loginPath(location.pathname + location.search)} replace />
  return children
}
