import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowRight, CheckCheck, HandCoins, Lock, PieChart, Plus, Receipt, Scale, Pencil, Trash2, Wallet, CalendarRange } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, ProgressBar } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Menu } from '../../components/ui/Menu'
import { EmptyState } from '../../components/ui/States'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ExpenseFormModal } from './ExpenseFormModal'
import { useTripActions } from '../trips/useTripActions'
import { BudgetModal } from './BudgetModal'
import { useTripContext } from '../trips/useTripContext'
import { useBalances } from '../../store/selectors'
import { toast } from '../../store/useToastStore'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KEYS, SPLIT_TYPES } from '../../data/categories'
import { formatMoney } from '../../utils/money'
import { relativeTime } from '../../utils/dates'

export default function ExpensesTab() {
  const { trip, members, expenses, itinerary, currentUserId, usersById, permissions } = useTripContext()
  const { balances, suggested, settlements } = useBalances(trip.id)
  const { expenses: actions } = useTripActions(trip)

  async function run(action, success) {
    try {
      await action()
      toast.success(success)
    } catch (error) {
      if (error.status !== 401) toast.error(error.message)
    }
  }

  const [expenseModal, setExpenseModal] = useState(null) // { expense? }
  const [deleting, setDeleting] = useState(null)
  const [settling, setSettling] = useState(null)
  const [filter, setFilter] = useState('all')
  const [editingBudget, setEditingBudget] = useState(false)

  const spent = expenses.reduce((s, e) => s + e.amountMinor, 0)
  const me = balances.find((b) => b.userId === currentUserId)
  const plannedCost = useMemo(
    () => itinerary.days.reduce((sum, d) => sum + itinerary.itemsByDay[d.id].reduce((s, i) => s + (i.costMinor ?? 0), 0), 0),
    [itinerary],
  )

  const byCategory = useMemo(() => {
    const totals = Object.fromEntries(EXPENSE_CATEGORY_KEYS.map((k) => [k, 0]))
    for (const e of expenses) totals[e.category ?? 'other'] += e.amountMinor
    return EXPENSE_CATEGORY_KEYS.map((key) => ({ key, amount: totals[key] }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const visible = filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)
  const over = trip.budgetMinor > 0 && spent > trip.budgetMinor
  const name = (id) => (id === currentUserId ? 'You' : usersById[id]?.name.split(' ')[0] ?? 'Someone')
  const memberIds = new Set(members.map((m) => m.id))

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <Wallet className="size-3.5" /> Group spend
            </p>
            {permissions.canSetBudget ? (
              <Button size="sm" variant="ghost" icon={Pencil} className="ml-auto -mr-2 h-7" onClick={() => setEditingBudget(true)}>
                {trip.budgetMinor > 0 ? 'Edit budget' : 'Set budget'}
              </Button>
            ) : (
              <Badge icon={Lock} className="ml-auto" tone="neutral">
                Set by Team Leader
              </Badge>
            )}
          </div>
          <p className="mt-2 font-display text-3xl font-semibold">{formatMoney(spent)}</p>
          {trip.budgetMinor > 0 ? (
            <>
              <ProgressBar className="mt-3" value={spent} max={trip.budgetMinor} tone={over ? 'danger' : spent / trip.budgetMinor > 0.85 ? 'coral' : 'ocean'} label="Budget used" />
              <p className={clsx('mt-1.5 text-xs', over ? 'font-semibold text-red-600' : 'text-slate-500')}>
                {Math.round((spent / trip.budgetMinor) * 100)}% of {formatMoney(trip.budgetMinor)}
                {over ? ` · ${formatMoney(spent - trip.budgetMinor)} over` : ` · ${formatMoney(trip.budgetMinor - spent)} left`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {permissions.canSetBudget ? 'Set a budget to track spending against it.' : 'The team leader hasn’t set a budget yet.'}
            </p>
          )}
        </Card>

        <Card className={clsx('p-5', me?.netMinor > 0 && 'bg-emerald-50/50', me?.netMinor < 0 && 'bg-coral-50/50')}>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Scale className="size-3.5" /> Your balance
          </p>
          <p className={clsx('mt-2 font-display text-3xl font-semibold', me?.netMinor > 0 ? 'text-emerald-700' : me?.netMinor < 0 ? 'text-coral-700' : 'text-slate-900')}>
            {formatMoney(Math.abs(me?.netMinor ?? 0))}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {me?.netMinor > 0 ? 'You are owed overall' : me?.netMinor < 0 ? 'You owe overall' : 'You’re all settled up 🎉'}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            You paid {formatMoney(me?.paidMinor ?? 0)} · your share {formatMoney(me?.owedMinor ?? 0)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <CalendarRange className="size-3.5" /> Per person
          </p>
          <p className="mt-2 font-display text-3xl font-semibold">{formatMoney(members.length ? Math.round(spent / members.length) : 0)}</p>
          <p className="mt-1 text-xs text-slate-500">Average across {members.length} travellers</p>
          {plannedCost > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Itinerary estimates: <span className="font-semibold text-slate-700">{formatMoney(plannedCost)}</span>
            </p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Expenses list */}
        <section className="min-w-0 space-y-4" aria-labelledby="expenses-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="expenses-heading" className="font-display text-xl font-semibold">
              Expenses <span className="font-sans text-sm font-medium text-slate-400">({expenses.length})</span>
            </h2>
            <Button icon={Plus} size="sm" onClick={() => setExpenseModal({})}>
              Add expense
            </Button>
          </div>

          {expenses.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
              {['all', ...byCategory.map((c) => c.key)].map((key) => {
                const config = EXPENSE_CATEGORIES[key]
                const active = filter === key
                const Icon = config?.icon
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(key)}
                    className={clsx(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-all',
                      active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-sand-200 hover:ring-slate-300',
                    )}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {config?.label ?? 'All'}
                  </button>
                )
              })}
            </div>
          )}

          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description="Add bookings, meals and tickets as they happen. Tripzy keeps a running tally of who owes whom."
              action={
                <Button icon={Plus} onClick={() => setExpenseModal({})}>
                  Add the first expense
                </Button>
              }
            />
          ) : (
            <Card as="ul" className="divide-y divide-sand-100">
              {visible.map((expense) => {
                const config = EXPENSE_CATEGORIES[expense.category] ?? EXPENSE_CATEGORIES.other
                const Icon = config.icon
                const myShare = expense.splits.find((s) => s.userId === currentUserId)?.shareMinor ?? 0
                return (
                  <li key={expense.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-sand-50/60 sm:gap-4">
                    <span className={clsx('grid size-11 shrink-0 place-items-center rounded-xl', config.soft)}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{expense.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Avatar user={usersById[expense.paidBy]} size="xs" /> {name(expense.paidBy)} paid
                        </span>
                        <span>· {relativeTime(expense.createdAt)}</span>
                        <Badge className="!py-0 text-[10px]">{SPLIT_TYPES[expense.splitType].label}</Badge>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 tabular-nums">{formatMoney(expense.amountMinor)}</p>
                      <p className="text-xs text-slate-500 tabular-nums">{myShare ? `your share ${formatMoney(myShare)}` : 'not involved'}</p>
                    </div>
                    <Menu
                      items={[
                        // Whoever added the expense, or the team leader (enforced by the API too).
                        { label: 'Edit expense', icon: Pencil, onClick: () => setExpenseModal({ expense }), hidden: !permissions.canEditExpense(expense) },
                        { label: 'Delete expense', icon: Trash2, onClick: () => setDeleting(expense), danger: true, hidden: !permissions.canEditExpense(expense) },
                      ]}
                    />
                  </li>
                )
              })}
            </Card>
          )}
        </section>

        {/* Side: breakdown, balances, settle up */}
        <aside className="space-y-4">
          <Card className="p-5">
            <CardHeader icon={PieChart} title="Spending by category" />
            {byCategory.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Categories appear once you add expenses.</p>
            ) : (
              <>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-sand-100" aria-hidden>
                  {byCategory.map((c) => (
                    <div key={c.key} className={EXPENSE_CATEGORIES[c.key].bar} style={{ width: `${(c.amount / spent) * 100}%` }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-3">
                  {byCategory.map((c) => {
                    const config = EXPENSE_CATEGORIES[c.key]
                    return (
                      <li key={c.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-2 text-slate-700">
                            <span className={clsx('size-2.5 rounded-full', config.bar)} /> {config.label}
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {formatMoney(c.amount)} <span className="font-normal text-slate-400">· {Math.round((c.amount / spent) * 100)}%</span>
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Card>

          <Card className="p-5">
            <CardHeader icon={Scale} title="Balances" description="Paid minus share, incl. settlements" />
            <ul className="mt-4 space-y-3">
              {balances.map((b) => {
                const member = usersById[b.userId]
                return (
                  <li key={b.userId} className="flex items-center gap-3">
                    <Avatar user={member} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                      {b.userId === currentUserId ? 'You' : (member?.name ?? 'Former member')}
                      {!memberIds.has(b.userId) && <span className="font-normal text-slate-400"> · left the trip</span>}
                    </span>
                    <span
                      className={clsx(
                        'text-sm font-semibold tabular-nums',
                        b.netMinor > 0 ? 'text-emerald-600' : b.netMinor < 0 ? 'text-coral-600' : 'text-slate-400',
                      )}
                    >
                      {b.netMinor > 0 ? '+' : b.netMinor < 0 ? '−' : ''}
                      {formatMoney(Math.abs(b.netMinor))}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="p-5">
            <CardHeader
              icon={HandCoins}
              title="Settle up"
              description={suggested.length ? `${suggested.length} ${suggested.length === 1 ? 'payment' : 'payments'} clears every debt` : undefined}
            />
            {suggested.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                <CheckCheck className="size-4" /> Everyone is square.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {suggested.map((p) => (
                  <li key={`${p.fromUser}-${p.toUser}`} className="rounded-xl bg-sand-50 p-3 ring-1 ring-sand-200/70">
                    <div className="flex items-center gap-2 text-sm">
                      <Avatar user={usersById[p.fromUser]} size="xs" />
                      <span className="font-semibold">{name(p.fromUser)}</span>
                      <ArrowRight className="size-3.5 text-slate-400" />
                      <Avatar user={usersById[p.toUser]} size="xs" />
                      <span className="font-semibold">{name(p.toUser)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-display text-lg font-semibold tabular-nums">{formatMoney(p.amountMinor)}</span>
                      {permissions.canRecordSettlement(p) && (
                        <Button size="sm" variant="secondary" icon={CheckCheck} onClick={() => setSettling(p)}>
                          Mark paid
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {settlements.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold text-slate-600">Settled payments ({settlements.length})</summary>
                <ul className="mt-2 space-y-1.5">
                  {settlements.map((s) => (
                    <li key={s.id} className="flex justify-between text-xs text-slate-500">
                      <span>
                        {name(s.fromUser)} → {name(s.toUser)}
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(s.amountMinor)} · {relativeTime(s.settledAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        </aside>
      </div>

      <BudgetModal open={editingBudget} onClose={() => setEditingBudget(false)} trip={trip} spentMinor={spent} />
      <ExpenseFormModal open={Boolean(expenseModal)} onClose={() => setExpenseModal(null)} trip={trip} members={members} currentUserId={currentUserId} expense={expenseModal?.expense} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this expense?"
        description={`“${deleting?.title}” (${formatMoney(deleting?.amountMinor ?? 0)}) will be removed and balances recalculated. This is recorded in the activity log.`}
        confirmLabel="Delete expense"
        onConfirm={() => {
          const target = deleting
          run(() => actions.remove(target.id), 'Expense deleted.')
        }}
      />
      <ConfirmDialog
        open={Boolean(settling)}
        onClose={() => setSettling(null)}
        tone="primary"
        title="Record this payment?"
        description={settling ? `${name(settling.fromUser)} paid ${name(settling.toUser)} ${formatMoney(settling.amountMinor)} outside Tripzy (cash, UPI, bank).` : ''}
        confirmLabel="Mark as paid"
        onConfirm={() => {
          const payment = settling
          run(() => actions.settle(payment), 'Payment recorded. Balances updated.')
        }}
      />
    </div>
  )
}
