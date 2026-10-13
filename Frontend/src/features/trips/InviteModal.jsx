import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Crown, Mail, Send, UserMinus, UserPlus, X } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button, IconButton } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'
import { invitesApi, tripsApi } from '../../api/endpoints'
import { formatDate } from '../../utils/dates'
import { useTripChanges } from './useTripRealtime'
import { ROLE_LABELS } from './permissions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function CopyField({ value }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Couldn’t access the clipboard — copy the link manually.')
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-sand-50 p-1.5 pl-3.5 ring-1 ring-sand-200">
      <code className="min-w-0 flex-1 truncate text-sm text-slate-700">{value}</code>
      <Button size="sm" variant={copied ? 'secondary' : 'primary'} icon={copied ? Check : Copy} onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

/** Leader: invite by email (server trips) and see pending invites. */
function EmailInvites({ trip }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [lastInvite, setLastInvite] = useState(null)
  const [pending, setPending] = useState([])

  const loadPending = useCallback(() => {
    invitesApi
      .list(trip.id)
      .then(({ invites }) => setPending(invites))
      .catch(() => {})
  }, [trip.id])

  useEffect(() => loadPending(), [loadPending])
  // Someone accepted an invite (or another leader tab sent one): keep the list current.
  useTripChanges(trip.id, ['trip', 'invites'], loadPending)

  async function send(event) {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) return setError('Enter a valid email address')
    setSending(true)
    setError('')
    try {
      const result = await invitesApi.create(trip.id, value)
      setLastInvite(result)
      setEmail('')
      toast.success(result.emailDelivered ? `Invite emailed to ${value}.` : `Invite created for ${value}.`)
      loadPending()
    } catch (err) {
      setError(err.details?.email ?? err.message)
    } finally {
      setSending(false)
    }
  }

  async function revoke(invite) {
    try {
      await invitesApi.revoke(trip.id, invite.id)
      setPending((list) => list.filter((i) => i.id !== invite.id))
      if (lastInvite?.invite.id === invite.id) setLastInvite(null)
      toast.info(`Invite to ${invite.email} cancelled.`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <div className="flex-1">
          <Input
            type="email"
            icon={Mail}
            aria-label="Invite by email"
            placeholder="friend@example.com"
            value={email}
            invalid={Boolean(error)}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
          />
        </div>
        <Button type="submit" icon={Send} loading={sending} className="h-11">
          Send invite
        </Button>
      </form>
      {error && (
        <p role="alert" className="-mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      {lastInvite && (
        <div className="rounded-2xl bg-ocean-50 p-3.5 ring-1 ring-ocean-100">
          <p className="text-sm font-semibold text-ocean-900">
            {lastInvite.emailDelivered ? `We emailed ${lastInvite.invite.email} a join link.` : `Share this link with ${lastInvite.invite.email}:`}
          </p>
          {!lastInvite.emailDelivered && <p className="mt-0.5 text-xs text-ocean-800">Email sending isn’t configured on the server, so copy the link instead.</p>}
          <div className="mt-2.5">
            <CopyField value={lastInvite.inviteUrl} />
          </div>
          <p className="mt-2 text-xs text-ocean-800">Only {lastInvite.invite.email} can use it, until {formatDate(lastInvite.invite.expiresAt.slice(0, 10))}.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Pending invites <span className="font-normal text-slate-400">({pending.length})</span>
          </h3>
          <ul className="mt-2 divide-y divide-sand-100">
            {pending.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 py-2">
                <span className="grid size-8 place-items-center rounded-full bg-sand-100 text-slate-500">
                  <Mail className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{invite.email}</p>
                  <p className="text-xs text-slate-500">
                    {invite.expired ? 'Expired' : `Expires ${formatDate(invite.expiresAt.slice(0, 10))}`}
                  </p>
                </div>
                <IconButton icon={X} label={`Cancel invite to ${invite.email}`} size="sm" variant="danger-ghost" onClick={() => revoke(invite)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function InviteModal({ open, onClose, trip, members, permissions, currentUserId }) {
  const removeMember = useTripzyStore((s) => s.removeMember)
  const [removing, setRemoving] = useState(null)
  const canInvite = permissions?.canInvite

  async function confirmRemove() {
    const member = removing
    try {
      if (trip.remote) await tripsApi.removeMember(trip.id, member.id)
      removeMember(trip.id, member.id)
      toast.success(`${member.name} was removed.`)
    } catch (err) {
      if (err.status !== 401) toast.error(err.message)
    }
  }

  return (
    <>
      <Modal
        open={open && !removing}
        onClose={onClose}
        title={canInvite && trip.remote ? 'Invite your crew' : 'Trip members'}
        description={canInvite && trip.remote ? 'Invite people by email. Each link works only for the address it was sent to.' : undefined}
        icon={UserPlus}
      >
        <div className="space-y-6">
          {!trip.remote ? (
            <p className="rounded-xl bg-violet-50 px-3.5 py-2.5 text-sm text-violet-900 ring-1 ring-violet-200">
              This is an example trip, so it can’t be shared. Plan your own trip to invite friends by email.
            </p>
          ) : canInvite ? (
            <EmailInvites trip={trip} />
          ) : (
            <p className="rounded-xl bg-sand-100 px-3.5 py-2.5 text-sm text-slate-600">Only the team leader can invite or remove people.</p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Members <span className="font-normal text-slate-400">({members.length})</span>
            </h3>
            <ul className="mt-2 divide-y divide-sand-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <Avatar user={m} size="md" online={m.online} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {m.name} {m.id === currentUserId && <span className="font-normal text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{m.email}</p>
                  </div>
                  {m.role === 'LEADER' ? (
                    <Badge tone="warning" icon={Crown}>
                      {ROLE_LABELS.LEADER}
                    </Badge>
                  ) : (
                    <>
                      <Badge tone="ocean">{ROLE_LABELS.MEMBER}</Badge>
                      {permissions?.canRemoveMembers && (
                        <IconButton icon={UserMinus} label={`Remove ${m.name}`} variant="danger-ghost" size="sm" onClick={() => setRemoving(m)} />
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name.split(' ')[0]}?`}
        description="They’ll lose access to this trip. Their places and expenses stay so balances remain correct."
        confirmLabel="Remove member"
        onConfirm={confirmRemove}
      />
    </>
  )
}
