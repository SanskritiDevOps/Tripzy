import { useState } from 'react'
import { Check, Copy, Crown, RefreshCw, UserMinus, UserPlus } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button, IconButton } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'
import { formatDate } from '../../utils/dates'

export function InviteModal({ open, onClose, trip, members, isOwner, currentUserId }) {
  const invites = useTripzyStore((s) => s.invites)
  const createInvite = useTripzyStore((s) => s.createInvite)
  const removeMember = useTripzyStore((s) => s.removeMember)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(null)

  const invite = invites
    .filter((i) => i.tripId === trip.id && new Date(i.expiresAt) > new Date())
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0]
  const link = invite ? `${window.location.origin}/join/${invite.token}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Couldn’t access the clipboard — copy the link manually.')
    }
  }

  return (
    <>
      <Modal open={open && !removing} onClose={onClose} title="Invite your crew" description="Anyone with the link can join until it expires." icon={UserPlus}>
        <div className="space-y-6">
          <div>
            {invite ? (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-sand-50 p-1.5 pl-3.5 ring-1 ring-sand-200">
                  <code className="min-w-0 flex-1 truncate text-sm text-slate-700">{link}</code>
                  <Button size="sm" variant={copied ? 'secondary' : 'primary'} icon={copied ? Check : Copy} onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Expires {formatDate(invite.expiresAt.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <button
                    type="button"
                    onClick={() => {
                      createInvite(trip.id)
                      toast.success('New invite link created.')
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-ocean-700 hover:underline"
                  >
                    <RefreshCw className="size-3" /> New link
                  </button>
                </div>
              </>
            ) : (
              <Button icon={UserPlus} onClick={() => createInvite(trip.id)}>
                Create invite link
              </Button>
            )}
          </div>

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
                  {m.role === 'OWNER' ? (
                    <Badge tone="warning" icon={Crown}>
                      Owner
                    </Badge>
                  ) : (
                    isOwner && <IconButton icon={UserMinus} label={`Remove ${m.name}`} variant="danger-ghost" size="sm" onClick={() => setRemoving(m)} />
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
        onConfirm={() => {
          removeMember(trip.id, removing.id)
          toast.success(`${removing.name} was removed.`)
        }}
      />
    </>
  )
}
