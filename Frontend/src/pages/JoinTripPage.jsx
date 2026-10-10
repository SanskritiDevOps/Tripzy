import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, LinkIcon, MapPin, Users } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'
import { AvatarStack } from '../components/ui/Avatar'
import { useTripzyStore } from '../store/useTripzyStore'
import { useTripMembers } from '../store/selectors'
import { toast } from '../store/useToastStore'
import { formatDateRange } from '../utils/dates'

/** /join/:token — local invite links for the bundled demo trips. */
export function LocalJoinTripPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const invite = useTripzyStore((s) => s.invites.find((i) => i.token === token))
  const trip = useTripzyStore((s) => s.trips.find((t) => t.id === invite?.tripId))
  const joinTrip = useTripzyStore((s) => s.joinTrip)
  const members = useTripMembers(trip?.id)
  const [error, setError] = useState('')
  const expired = invite && new Date(invite.expiresAt) < new Date()

  if (!invite || !trip || expired) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={LinkIcon}
          title={expired ? 'This invite has expired' : 'Invite not found'}
          description="Ask the team leader to share a fresh invite link."
          action={<Button to="/trips">Go to my trips</Button>}
        />
      </div>
    )
  }

  function join() {
    const result = joinTrip(token)
    if (result.error) return setError(result.error)
    toast.success(`You joined ${trip.name}!`)
    navigate(`/trips/${result.tripId}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-ocean-600 to-ocean-800 px-6 py-8 text-white">
          <p className="text-sm font-semibold text-ocean-100">You’re invited to plan</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-white">{trip.name}</h1>
        </div>
        <div className="space-y-3 p-6">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="size-4 text-slate-400" /> {trip.destination}
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="size-4 text-slate-400" /> {formatDateRange(trip.startDate, trip.endDate)}
          </p>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Users className="size-4 text-slate-400" />
            <AvatarStack users={members} size="xs" />
            {members.length} travellers
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <Button size="lg" className="mt-3 w-full" onClick={join}>
            Join trip
          </Button>
        </div>
      </Card>
    </div>
  )
}
