import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Backpack, Check, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { Card, ProgressBar, SegmentedControl } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/States'
import { useTripContext } from '../trips/useTripContext'
import { useTripPacking } from '../../store/selectors'
import { useTripActions } from '../trips/useTripActions'
import { toast } from '../../store/useToastStore'
import { PACKING_CATEGORIES, PACKING_CATEGORY_KEYS } from '../../data/categories'

const SUGGESTIONS = [
  ['toiletries', 'Sunscreen'],
  ['gear', 'Umbrella'],
  ['electronics', 'Travel adapter'],
  ['health', 'Hand sanitiser'],
  ['clothing', 'Swimwear'],
  ['documents', 'Travel insurance'],
  ['gear', 'Day backpack'],
  ['health', 'Motion-sickness tablets'],
  ['clothing', 'Light jacket'],
  ['electronics', 'Earphones'],
]

export default function PackingTab() {
  const { trip, members, usersById, permissions } = useTripContext()
  const items = useTripPacking(trip.id)
  const { packing: actions } = useTripActions(trip)

  async function run(action, success) {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      if (error.status !== 401) toast.error(error.message)
    }
  }

  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('clothing')
  const [ownerId, setOwnerId] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  const packed = items.filter((i) => i.packed).length
  const pct = items.length ? Math.round((packed / items.length) * 100) : 0

  const grouped = useMemo(() => {
    const visible = items.filter((i) => filter === 'all' || (filter === 'todo' ? !i.packed : i.packed))
    return PACKING_CATEGORY_KEYS.map((key) => ({
      key,
      items: visible.filter((i) => i.category === key).sort((a, b) => Number(a.packed) - Number(b.packed)),
      total: items.filter((i) => i.category === key).length,
      done: items.filter((i) => i.category === key && i.packed).length,
    })).filter((g) => g.items.length > 0)
  }, [items, filter])

  const suggestions = useMemo(() => {
    const existing = new Set(items.map((i) => i.label.toLowerCase()))
    return SUGGESTIONS.filter(([, l]) => !existing.has(l.toLowerCase())).slice(0, 6)
  }, [items])

  function add(event) {
    event.preventDefault()
    const trimmed = label.trim()
    if (trimmed.length < 2) return setError('Type an item to add')
    if (items.some((i) => i.label.toLowerCase() === trimmed.toLowerCase())) return setError('That’s already on the list')
    setLabel('')
    setError('')
    run(() => actions.add({ label: trimmed, category, ownerId: ownerId || null }))
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0 space-y-5" aria-labelledby="packing-heading">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="packing-heading" className="font-display text-xl font-semibold">
                Packing checklist
              </h2>
              <p className="text-sm text-slate-500">
                {packed} of {items.length} packed {pct === 100 && items.length > 0 && '· ready to go! 🎒'}
              </p>
            </div>
            <span className={clsx('font-display text-3xl font-semibold', pct === 100 ? 'text-emerald-600' : 'text-ocean-700')}>{pct}%</span>
          </div>
          <ProgressBar className="mt-3" value={packed} max={items.length || 1} tone={pct === 100 ? 'success' : 'ocean'} label="Packing progress" />

          <form onSubmit={add} className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]">
            <Input
              aria-label="New item"
              placeholder="Add an item, e.g. Power bank"
              value={label}
              invalid={Boolean(error)}
              onChange={(e) => {
                setLabel(e.target.value)
                setError('')
              }}
            />
            <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {PACKING_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PACKING_CATEGORIES[key].label}
                </option>
              ))}
            </Select>
            <Select aria-label="Who’s bringing it" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name.split(' ')[0]}
                </option>
              ))}
            </Select>
            <Button type="submit" icon={Plus} className="h-11">
              Add
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            size="sm"
            aria-label="Filter items"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: items.length },
              { value: 'todo', label: 'To pack', count: items.length - packed },
              { value: 'done', label: 'Packed', count: packed },
            ]}
          />
          {packed > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              onClick={() => run(() => actions.reset(), 'Checklist reset — time to pack again.')}
            >
              Uncheck all
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState icon={Backpack} title="Nothing on the list" description="Add the essentials above, or tap a suggestion." />
        ) : grouped.length === 0 ? (
          <EmptyState compact icon={Check} title={filter === 'todo' ? 'Everything is packed!' : 'Nothing packed yet'} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {grouped.map((group) => {
              const { label: groupLabel, icon: Icon } = PACKING_CATEGORIES[group.key]
              return (
                <Card key={group.key} className="p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-sand-100 text-ocean-700">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <h3 className="flex-1 text-sm font-semibold">{groupLabel}</h3>
                    <span className="text-xs font-semibold text-slate-400">
                      {group.done}/{group.total}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {group.items.map((item) => (
                      <li key={item.id} className="group flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-sand-50">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.packed}
                          onClick={() => run(() => actions.toggle(item))}
                          className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                        >
                          <span
                            className={clsx(
                              'grid size-5 shrink-0 place-items-center rounded-md ring-1 transition-all',
                              item.packed ? 'bg-emerald-500 text-white ring-emerald-500' : 'bg-white ring-sand-300 group-hover:ring-ocean-400',
                            )}
                          >
                            {item.packed && <Check className="size-3.5" strokeWidth={3} />}
                          </span>
                          <span className={clsx('truncate text-sm transition-colors', item.packed ? 'text-slate-400 line-through' : 'text-slate-800')}>
                            {item.label}
                          </span>
                        </button>
                        {item.ownerId && usersById[item.ownerId] && <Avatar user={usersById[item.ownerId]} size="xs" />}
                        {permissions.canDeletePackingItem(item) && (
                          <IconButton
                            icon={Trash2}
                            label={`Remove ${item.label}`}
                            size="sm"
                            variant="danger-ghost"
                            onClick={() => run(() => actions.remove(item.id))}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-violet-500" /> Suggestions
          </h3>
          {suggestions.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">You’ve got all our usual suggestions covered.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map(([cat, l]) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => run(() => actions.add({ label: l, category: cat }), `${l} added.`)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-sand-200 transition-all hover:ring-ocean-300 hover:text-ocean-700"
                >
                  <Plus className="size-3" /> {l}
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Shared items</h3>
          <p className="mt-1 text-xs text-slate-500">Assign group items to one person so you don’t end up with four speakers and no charger.</p>
          <ul className="mt-3 space-y-2">
            {members.map((m) => {
              const count = items.filter((i) => i.ownerId === m.id).length
              return (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <Avatar user={m} size="xs" />
                  <span className="flex-1 truncate text-slate-700">{m.name}</span>
                  <span className="text-xs text-slate-400">
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </aside>
    </div>
  )
}
