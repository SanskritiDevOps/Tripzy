import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Toaster } from '../ui/Toaster'
import { useCurrentUser } from '../../store/selectors'

export function AppShell() {
  const { pathname } = useLocation()
  const transparent = pathname === '/'
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar transparent={transparent} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}

/** Redirects to /login when there is no session, remembering where to return. */
export function RequireAuth({ children }) {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}
