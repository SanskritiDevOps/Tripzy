import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Compass, Luggage, LogOut, Menu, X, ChevronDown, Plus } from 'lucide-react'
import { Logo } from './Logo'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { useAuthStore } from '../../store/useAuthStore'
import { useCurrentUser } from '../../store/selectors'
import { toast } from '../../store/useToastStore'

const LINKS = [
  { to: '/', label: 'Discover', icon: Compass, end: true },
  { to: '/trips', label: 'My trips', icon: Luggage, auth: true },
]

export function Navbar({ transparent = false }) {
  const sessionUser = useAuthStore((s) => s.user)
  const localProfile = useCurrentUser()
  // Profile comes from the API; the avatar colour from the local trip data.
  const user = sessionUser ? { ...sessionUser, color: localProfile?.color } : null
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef(null)

  // Close menus on navigation.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMobileOpen(false)
    setMenuOpen(false)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false)
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleLogout() {
    try {
      await logout()
      toast.info('You’ve been logged out.')
    } catch {
      // Local session is cleared even if the server couldn't be reached.
      toast.info('Logged out on this device.')
    }
    navigate('/')
  }

  const solid = !transparent || scrolled || mobileOpen
  const links = LINKS.filter((l) => !l.auth || user)

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 transition-colors duration-200',
        solid ? 'border-b border-sand-200/80 bg-sand-50/85 backdrop-blur-md' : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Logo to={user ? '/trips' : '/'} />

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                  isActive ? 'bg-white text-ocean-800 shadow-sm ring-1 ring-sand-200' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Button size="sm" variant="accent" icon={Plus} to="/trips?new=1">
                New trip
              </Button>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-white"
                >
                  <Avatar user={user} size="sm" />
                  <span className="max-w-32 truncate text-sm font-semibold text-slate-800">{user.name.split(' ')[0]}</span>
                  <ChevronDown className={clsx('size-4 text-slate-400 transition-transform', menuOpen && 'rotate-180')} />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-sand-200 animate-pop-in">
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-sand-100" />
                    <MenuItem icon={LogOut} onClick={handleLogout}>
                      Log out
                    </MenuItem>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" to="/login">
                Log in
              </Button>
              <Button size="sm" to="/signup">
                Get started
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="ml-auto grid size-10 place-items-center rounded-xl text-slate-700 hover:bg-white md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-sand-200 bg-sand-50 px-4 pt-3 pb-5 shadow-soft animate-fade-in md:hidden">
          {user && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-sand-200">
              <Avatar user={user} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
          )}
          <div className="space-y-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold',
                    isActive ? 'bg-white text-ocean-800 ring-1 ring-sand-200' : 'text-slate-700',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {user ? (
              <>
                <Button variant="accent" icon={Plus} to="/trips?new=1">
                  New trip
                </Button>
                <Button variant="ghost" icon={LogOut} onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button to="/signup">Get started</Button>
                <Button variant="secondary" to="/login">
                  Log in
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function MenuItem({ icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-sand-50"
    >
      <Icon className="size-4 text-slate-400" aria-hidden />
      {children}
    </button>
  )
}
