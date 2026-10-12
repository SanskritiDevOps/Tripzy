import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, AlertCircle, Receipt } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KEYS, SPLIT_TYPES } from '../../data/categories'
import { buildSplits, formatMoney, splitEqual, toInputValue, toMinor } from '../../utils/money'
import { newId } from '../../store/useTripzyStore'
import { useTripActions } from '../trips/useTripActions'
import { toast } from '../../store/useToastStore'
import { useUsersById } from '../../store/selectors'

export function ExpenseFormModal({ open, onClose, ...props }) {
  return open ? <ExpenseForm onClose={onClose} {...props} /> : null
}

function initialParticipants(members, expense) {
  return members.map((m) => {
    const split = expense?.splits.find((s) => s.userId === m.id)
    let value = ''
    if (expense?.splitType === 'EXACT' && split) value = toInputValue(split.shareMinor)
    if (expense?.splitType === 'PERCENT' && split) value = String(Math.round((split.shareMinor / expense.amountMinor) * 10000) / 100)
    return { userId: m.id, included: expense ? Boolean(split) : true, value }
  })
}

function ExpenseForm({ onClose, trip, members: currentMembers, currentUserId, expense = null }) {
  const { expenses: actions } = useTripActions(trip)
  const isEdit = Boolean(expense)
  const usersById = useUsersById()
  // Editing an old expense: people who were on it stay listed even if they've since
  // left the trip, so saving never silently drops their share or changes the payer.
  const [members] = useState(() => {
    const ids = new Set(currentMembers.map((m) => m.id))
    const former = expense ? [expense.paidBy, ...expense.splits.map((s) => s.userId)].filter((id, i, all) => !ids.has(id) && all.indexOf(id) === i) : []
    return [...currentMembers, ...former.map((id) => ({ id, name: usersById[id]?.name ?? 'Former member', avatarUrl: usersById[id]?.avatarUrl ?? null, color: usersById[id]?.color, left: true }))]
  })

  // One key per modal session: retries / double-clicks can't create duplicates.
  const [idempotencyKey] = useState(() => newId('idem'))
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amount, setAmount] = useState(expense ? toInputValue(expense.amountMinor) : '')
  const [category, setCategory] = useState(expense?.category ?? 'food')
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? currentUserId)
  const [splitType, setSplitType] = useState(expense?.splitType ?? 'EQUAL')
  const [participants, setParticipants] = useState(() => initialParticipants(members, expense))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const amountMinor = toMinor(amount)
  const included = participants.filter((p) => p.included)
  const membersById = Object.fromEntries(members.map((m) => [m.id, m]))

  const preview = useMemo(() => {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) return null
    if (splitType === 'EQUAL') return { ok: true, shares: Object.fromEntries(splitEqual(amountMinor, included.map((p) => p.userId)).map((s) => [s.userId, s.shareMinor])) }
    if (splitType === 'EXACT') {
      const total = included.reduce((sum, p) => sum + (toMinor(p.value || '0') || 0), 0)
      return { ok: total === amountMinor, remaining: amountMinor - total, label: formatMoney(Math.abs(amountMinor - total)) }
    }
    const pct = included.reduce((sum, p) => sum + Math.round(Number(p.value || 0) * 100), 0)
    return { ok: pct === 10000, remaining: 10000 - pct, label: `${Math.abs(10000 - pct) / 100}%` }
  }, [amountMinor, splitType, included])

  function setParticipant(userId, patch) {
    setParticipants((list) => list.map((p) => (p.userId === userId ? { ...p, ...patch } : p)))
  }

  function fillEvenly() {
    const ids = included.map((p) => p.userId)
    if (splitType === 'EXACT' && amountMinor > 0) {
      const shares = Object.fromEntries(splitEqual(amountMinor, ids).map((s) => [s.userId, s.shareMinor]))
      setParticipants((list) => list.map((p) => (p.included ? { ...p, value: toInputValue(shares[p.userId]) } : p)))
    }
    if (splitType === 'PERCENT' && ids.length) {
      const bp = Object.fromEntries(splitEqual(10000, ids).map((s) => [s.userId, s.shareMinor]))
      setParticipants((list) => list.map((p) => (p.included ? { ...p, value: String(bp[p.userId] / 100) } : p)))
    }
  }

  async function save(event) {
    event?.preventDefault()
    const next = {}
    if (title.trim().length < 2) next.title = 'What was this for?'
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) next.amount = 'Enter an amount greater than zero'
    const result = buildSplits({ amountMinor, splitType, participants: included })
    if (!next.amount && result.error) next.splits = result.error
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    const payload = { title: title.trim(), amountMinor, paidBy, splitType, category, splits: result.splits }
    // What the API needs to rebuild the splits itself (it never trusts client-side shares).
    const participants =
      splitType === 'EQUAL'
        ? included.map((p) => ({ userId: p.userId }))
        : splitType === 'EXACT'
          ? result.splits.map((s) => ({ userId: s.userId, value: s.shareMinor }))
          : included.map((p) => ({ userId: p.userId, value: Number(p.value || 0) }))
    try {
      if (isEdit) {
        await actions.update(expense.id, payload, participants)
        toast.success('Expense updated. Balances recalculated.')
      } else {
        await actions.add({ ...payload, idempotencyKey }, participants)
        toast.success(`${formatMoney(amountMinor)} added. Balances updated for everyone.`)
      }
      onClose()
    } catch (error) {
      setSaving(false)
      if (error.status === 401) return
      const field = Object.keys(error.details ?? {})[0]
      if (field === 'title') setErrors({ title: error.details.title })
      else if (field === 'amountMinor') setErrors({ amount: error.details.amountMinor })
      else if (field) setErrors({ splits: error.details[field] })
      else toast.error(error.message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={Receipt}
      title={isEdit ? 'Edit expense' : 'Add an expense'}
      description="Amounts are stored to the paisa, so splits always add up."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {isEdit ? 'Save expense' : 'Add expense'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <Field label="Description" error={errors.title}>
            {({ id, invalid }) => <Input id={id} value={title} invalid={invalid} placeholder="Dinner at Bar Palladio" onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Amount" error={errors.amount}>
            {({ id, invalid }) => <Input id={id} inputMode="decimal" prefix="₹" value={amount} invalid={invalid} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid by">
            {({ id }) => (
              <Select id={id} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === currentUserId ? `${m.name} (you)` : m.left ? `${m.name} (left the trip)` : m.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Category">
            {({ id }) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {EXPENSE_CATEGORIES[key].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Split</span>
            <SegmentedControl
              size="sm"
              aria-label="Split type"
              value={splitType}
              onChange={(v) => {
                setSplitType(v)
                setErrors((e) => ({ ...e, splits: undefined }))
              }}
              options={Object.entries(SPLIT_TYPES).map(([value, { label }]) => ({ value, label }))}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">{SPLIT_TYPES[splitType].hint}</p>

          <ul className="mt-3 divide-y divide-sand-100 rounded-2xl ring-1 ring-sand-200">
            {participants.map((p) => {
              const member = membersById[p.userId]
              return (
                <li key={p.userId} className={clsx('flex items-center gap-3 px-3 py-2.5', !p.included && 'opacity-50')}>
                  <input
                    type="checkbox"
                    checked={p.included}
                    onChange={(e) => setParticipant(p.userId, { included: e.target.checked })}
                    aria-label={`Include ${member.name}`}
                    className="size-4 cursor-pointer accent-ocean-600"
                  />
                  <Avatar user={member} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {member.name.split(' ')[0]}
                    {member.id === currentUserId && <span className="text-slate-400"> (you)</span>}
                    {member.left && <span className="text-slate-400"> (left the trip)</span>}
                  </span>
                  {splitType === 'EQUAL' ? (
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">
                      {p.included && preview?.shares ? formatMoney(preview.shares[p.userId] ?? 0) : '—'}
                    </span>
                  ) : (
                    <div className="w-28">
                      <Input
                        aria-label={`${member.name} ${splitType === 'EXACT' ? 'amount' : 'percent'}`}
                        inputMode="decimal"
                        disabled={!p.included}
                        prefix={splitType === 'EXACT' ? '₹' : undefined}
                        placeholder={splitType === 'EXACT' ? '0' : '0 %'}
                        value={p.value}
                        onChange={(e) => setParticipant(p.userId, { value: e.target.value })}
                        className="!h-9 text-right"
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {splitType !== 'EQUAL' && preview && (
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={clsx('inline-flex items-center gap-1 font-semibold', preview.ok ? 'text-emerald-600' : 'text-amber-700')}>
                {preview.ok ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                {preview.ok ? 'Adds up exactly' : preview.remaining > 0 ? `${preview.label} left to assign` : `${preview.label} over`}
              </span>
              <button type="button" onClick={fillEvenly} className="font-semibold text-ocean-700 hover:underline">
                Fill evenly
              </button>
            </div>
          )}
          {errors.splits && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-600">
              {errors.splits}
            </p>
          )}
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
