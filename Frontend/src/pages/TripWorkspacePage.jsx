import { Suspense, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  Activity,
  ArrowLeft,
  Backpack,
  CalendarDays,
  CalendarRange,
  Crown,
  LogOut,
  MapPin,
  MapPinned,
  Settings2,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Menu } from '../components/ui/Menu'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState, PanelSkeleton } from '../components/ui/States'
import { AvatarStack } from '../components/ui/Avatar'
import { TripSummaryBar } from '../features/trips/TripSummaryBar'
import { InviteModal } from '../features/trips/InviteModal'
import { ActivityFeed } from '../features/trips/ActivityFeed'
import { TripFormModal } from '../features/trips/TripFormModal'
import {
  useItinerary,
  useMembership,
  useTrip,
  useTripActivity,
  useTripExpenses,
  useTripMembers,
  useTripPlaces,
  useUsersById,
} from '../store/selectors'
import { useTripzyStore } from '../store/useTripzyStore'
import { toast } from '../store/useToastStore'
import { DESTINATIONS } from '../data/destinations'
import { tripsApi } from '../api/endpoints'
import { useRemoteTripsSync } from '../features/trips/useRemoteTripsSync'
import { FullPageLoader } from '../components/layout/AppShell'
import { useRemotePlacesSync } from '../features/places/useRemotePlacesSync'
import { getTripPermissions, ROLE_LABELS } from '../features/trips/permissions'
import { Badge } from '../components/ui/Badge'
import { formatDateRange } from '../utils/dates'

const TABS = [
  { to: 'itinerary', label: 'Itinerary', icon: CalendarRange },
  { to: 'places', label: 'Places', icon: MapPinned },
  { to: 'budget', label: 'Budget', icon: Wallet },
  { to: 'packing', label: 'Packing', icon: Backpack },
]

export function TripWorkspacePage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const membership = useMembership(tripId)
  const members = useTripMembers(tripId)
  const places = useTripPlaces(tripId)
  const expenses = useTripExpenses(tripId)
  const itinerary = useItinerary(tripId)
  const activity = useTripActivity(tripId, 30)
  const usersById = useUsersById()
  const currentUserId = useTripzyStore((s) => s.currentUserId)
  const deleteTrip = useTripzyStore((s) => s.deleteTrip)
  const removeMember = useTripzyStore((s) => s.removeMember)
  const { syncing } = useRemoteTripsSync()
  useRemotePlacesSync(trip)
  const permissions = useMemo(() => getTripPermissions(membership?.role), [membership?.role])

  const [dialog, setDialog] = useState(null) // 'invite' | 'settings' | 'activity' | 'delete' | 'leave'
  const close = () => setDialog(null)

  const placesById = useMemo(() => Object.fromEntries(places.map((p) => [p.id, p])), [places])
  const spentMinor = useMemo(() => expenses.reduce((sum, e) => sum + e.amountMinor, 0), [expenses])

  if (!trip && syncing) return <FullPageLoader label="Loading trip" />

  if (!trip) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState icon={MapPin} title="Trip not found" description="It may have been deleted by the team leader." action={<Button to="/trips">Back to my trips</Button>} />
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={ShieldAlert}
          title="You’re not a member of this trip"
          description="Ask someone in the group for an invite link to join."
          action={<Button to="/trips">Back to my trips</Button>}
        />
      </div>
    )
  }

  /** Runs the API call for server-stored trips (demo trips are local only). Returns false on failure. */
  async function syncWithServer(call) {
    if (!trip.remote) return true
    try {
      await call()
      return true
    } catch (error) {
      if (error.status !== 401) toast.error(error.message)
      return false
    }
  }
  const destination = DESTINATIONS.find((d) => d.id === trip.destinationId)
  const context = { trip, members, places, placesById, itinerary, expenses, permissions, currentUserId, usersById }

  return (
    <div className="pb-24 md:pb-12">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="border-b border-sand-200 bg-gradient-to-b from-ocean-50/80 to-sand-50">
        <div className="mx-auto max-w-7xl px-4 pt-5 pb-5 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" icon={ArrowLeft} to="/trips" className="-ml-2 text-slate-500">
            My trips
          </Button>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl shadow-soft ring-1 ring-sand-200 sm:grid" aria-hidden>
                {destination?.emoji ?? '🧭'}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">{trip.name}</h1>
                  <Badge tone={permissions.isLeader ? 'warning' : 'ocean'} icon={permissions.isLeader ? Crown : undefined}>
                    {permissions.isLeader ? 'You’re the Team Leader' : ROLE_LABELS.MEMBER}
                  </Badge>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden /> {trip.destination}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-4" aria-hidden /> {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDialog('invite')} className="mr-1 rounded-full" aria-label="Show members">
                <AvatarStack users={members} size="sm" max={4} showPresence />
              </button>
              <Button variant="secondary" size="sm" icon={Activity} onClick={() => setDialog('activity')} className="hidden sm:inline-flex">
                Activity
              </Button>
              <Button size="sm" icon={permissions.canInvite ? UserPlus : Users} onClick={() => setDialog('invite')}>
                {permissions.canInvite ? 'Invite' : 'Members'}
              </Button>
              <Menu
                label="Trip options"
                items={[
                  { label: 'Activity feed', icon: Activity, onClick: () => setDialog('activity') },
                  { label: 'Trip settings', icon: Settings2, onClick: () => setDialog('settings'), hidden: !permissions.canEditTripDetails },
                  { label: 'Leave trip', icon: LogOut, onClick: () => setDialog('leave'), hidden: permissions.isLeader, danger: true },
                  { label: 'Delete trip', icon: Trash2, onClick: () => setDialog('delete'), hidden: !permissions.canDeleteTrip, danger: true },
                ]}
              />
            </div>
          </div>

          <div className="mt-5">
            <TripSummaryBar trip={trip} members={members} spentMinor={spentMinor} itinerary={itinerary} placesById={placesById} permissions={permissions} />
          </div>

          {/* Desktop / tablet tabs */}
          <nav className="mt-5 hidden gap-1 md:flex" aria-label="Trip sections">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                    isActive ? 'bg-ocean-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Suspense fallback={<PanelSkeleton />}>
          <Outlet context={context} />
        </Suspense>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Trip sections"
      >
        <div className="grid grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors', isActive ? 'text-ocean-700' : 'text-slate-400')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={clsx('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-ocean-50')}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Dialogs ──────────────────────────────────────────── */}
      <InviteModal open={dialog === 'invite'} onClose={close} trip={trip} members={members} permissions={permissions} currentUserId={currentUserId} />
      <TripFormModal open={dialog === 'settings'} onClose={close} trip={trip} permissions={permissions} />
      <Modal open={dialog === 'activity'} onClose={close} title="Activity" description="What your group has been up to." icon={Activity}>
        <ActivityFeed entries={activity} usersById={usersById} />
      </Modal>
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={close}
        title="Delete this trip?"
        description={`“${trip.name}” and all its places, votes, itinerary and expenses will be deleted for everyone. This can’t be undone.`}
        confirmLabel="Delete trip"
        onConfirm={async () => {
          if (!(await syncWithServer(() => tripsApi.remove(trip.id)))) return
          navigate('/trips', { replace: true })
          deleteTrip(trip.id)
          toast.success('Trip deleted.')
        }}
      />
      <ConfirmDialog
        open={dialog === 'leave'}
        onClose={close}
        title="Leave this trip?"
        description="You’ll need a new invite link to rejoin."
        confirmLabel="Leave trip"
        onConfirm={async () => {
          if (!(await syncWithServer(() => tripsApi.removeMember(trip.id, currentUserId)))) return
          navigate('/trips', { replace: true })
          removeMember(trip.id, currentUserId)
          toast.info(`You left ${trip.name}.`)
        }}
      />
    </div>
  )
}
