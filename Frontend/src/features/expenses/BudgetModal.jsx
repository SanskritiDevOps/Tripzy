import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { formatMoney, toInputValue, toMinor } from '../../utils/money'
import { tripsApi } from '../../api/endpoints'
import { useTripzyStore } from '../../store/useTripzyStore'
import { toast } from '../../store/useToastStore'

/** Team leader only: PATCH /api/trips/:id/budget (the API rejects anyone else with 403). */
export function BudgetModal({ open, onClose, trip, spentMinor }) {
  return open ? <BudgetForm onClose={onClose} trip={trip} spentMinor={spentMinor} /> : null
}

function BudgetForm({ onClose, trip, spentMinor }) {
  const updateTrip = useTripzyStore((s) => s.updateTrip)
  const [value, setValue] = useState(toInputValue(trip.budgetMinor))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(event) {
    event?.preventDefault()
    const budgetMinor = value.trim() === '' ? 0 : toMinor(value)
    if (Number.isNaN(budgetMinor)) return setError('Enter a valid amount, e.g. 1,20,000')
    setSaving(true)
    try {
      if (trip.remote) await tripsApi.updateBudget(trip.id, budgetMinor)
      updateTrip(trip.id, { budgetMinor })
      toast.success(budgetMinor ? `Budget set to ${formatMoney(budgetMinor)}.` : 'Budget removed.')
      onClose()
    } catch (err) {
      if (err.status !== 401) setError(err.details?.budgetMinor ?? err.message)
      setSaving(false)
    }
  }

  const preview = toMinor(value || '0')

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={Wallet}
      title="Trip budget"
      description="The total for the whole group. Only you, as team leader, can change it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save budget
          </Button>
        </>
      }
    >
      <form onSubmit={save} noValidate>
        <Field
          label="Total budget"
          error={error}
          hint={!Number.isNaN(preview) && preview > 0 ? `${formatMoney(spentMinor)} spent so far · ${Math.round((spentMinor / preview) * 100)}% of this budget` : 'Leave empty to remove the budget'}
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              inputMode="decimal"
              prefix="₹"
              placeholder="1,20,000"
              value={value}
              invalid={invalid}
              data-autofocus
              onChange={(e) => {
                setValue(e.target.value)
                setError('')
              }}
            />
          )}
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
