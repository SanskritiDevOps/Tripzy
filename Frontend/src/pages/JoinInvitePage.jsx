import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CalendarDays, LinkIcon, LogIn, LogOut, Mail, MapPin, UserPlus, Users } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'
import { FullPageLoader } from '../components/layout/AppShell'
import { invitesApi, tripsApi } from '../api/endpoints'
import { useAuthStore } from '../store/useAuthStore'
import { toast } from '../store/useToastStore'
import { formatDateRange } from '../utils/dates'
import { loginPath } from '../utils/urls'

const CLOSED = {
  ACCEPTED: { title: 'This invite has already been used', description: 'If it was yours, the trip is already in My trips.' },
  REVOKED: { title: 'This invite was cancelled', description: 'Ask the team leader to send you a new one.' },
  EXPIRED: { title: 'This invite has expired', description: 'Invites last 7 days. Ask the team leader to send a new one.' },
}

/**
 * /join-trip?token=… — the link in invite emails.
 * Anyone can see which trip it's for; joining needs an account whose email
 * matches the invite (enforced by POST /api/trips/join).
 */
export function JoinInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const authStatus = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [preview, setPreview] = useState({ loading: Boolean(token), invite: null, error: token ? null : 'missing' })
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)

  useEffect(() => {
    if (!token) return
    let active = true
    invitesApi
      .preview(token)
      .then(({ invite }) => active && setPreview({ loading: false, invite, error: null }))
      .catch((error) => active && setPreview({ loading: false, invite: null, error: error.message }))
    return () => {
      active = false
    }
  }, [token])

  async function join() {
    setJoining(true)
    setJoinError(null)
    try {
      const { trip } = await tripsApi.join(token)
      toast.success(`You joined ${trip.name}!`)
      navigate(`/trips/${trip.id}`, { replace: true })
    } catch (error) {
      setJoining(false)
      if (error.status !== 401) setJoinError(error)
    }
  }

  async function switchAccount() {
    await logout().catch(() => {})
    navigate(loginPath(`/join-trip?token=${encodeURIComponent(token)}`), { replace: true })
  }

  if (preview.loading || authStatus === 'unknown') return <FullPageLoader label="Opening your invite" />

  if (!preview.invite) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={LinkIcon}
          title="Invite not found"
          description={preview.error === 'missing' ? 'This link is missing its invite code.' : 'The link may be mistyped or no longer valid. Ask the team leader for a new one.'}
          action={<Button to="/">Go to Tripzy</Button>}
        />
      </div>
    )
  }

  const { invite } = preview
  const closedReason = invite.status !== 'PENDING' ? invite.status : invite.expired ? 'EXPIRED' : null
  if (closedReason) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState icon={LinkIcon} {...CLOSED[closedReason]} action={<Button to={authStatus === 'authenticated' ? '/trips' : '/'}>Go to Tripzy</Button>} />
      </div>
    )
  }

  const returnTo = `/join-trip?token=${encodeURIComponent(token)}`
  const emailMismatch = joinError?.code === 'INVITE_EMAIL_MISMATCH'

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-ocean-600 to-ocean-800 px-6 py-8 text-white">
          <p className="text-sm font-semibold text-ocean-100">{invite.invitedBy ? `${invite.invitedBy} invited you to plan` : 'You’re invited to plan'}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-white">{invite.trip.name}</h1>
        </div>
        <div className="space-y-3 p-6">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="size-4 text-slate-400" /> {invite.trip.destination}
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="size-4 text-slate-400" /> {formatDateRange(invite.trip.startDate, invite.trip.endDate)}
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="size-4 text-slate-400" /> {invite.trip.memberCount} {invite.trip.memberCount === 1 ? 'traveller' : 'travellers'} so far
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Mail className="size-4 text-slate-400" /> Invite for {invite.email}
          </p>
          <p className="rounded-xl bg-sand-100 px-3.5 py-2.5 text-xs text-slate-600">
            You’ll join as a <b>Member</b>: you can add and edit places and the itinerary. The team leader manages the budget, locks and invitations.
          </p>

          {joinError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {joinError.message}
            </div>
          )}

          {authStatus === 'authenticated' ? (
            <div className="space-y-2 pt-2">
              {emailMismatch ? (
                <Button size="lg" className="w-full" icon={LogOut} onClick={switchAccount}>
                  Log in with a different account
                </Button>
              ) : (
                <Button size="lg" className="w-full" icon={UserPlus} loading={joining} onClick={join}>
                  Join trip
                </Button>
              )}
              <p className="text-center text-xs text-slate-500">Signed in as {user?.email}</p>
            </div>
          ) : (
            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              <Button size="lg" icon={LogIn} to={loginPath(returnTo)}>
                Log in to join
              </Button>
              <Button size="lg" variant="secondary" to={loginPath(returnTo, '/signup')}>
                Create account
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
