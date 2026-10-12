// Balances and debt simplification — README §10.2.

/**
 * Net balance per member = total paid − total owed (+ settlements).
 * Positive → should receive money, negative → should pay.
 */
export function computeBalances(memberIds, expenses, settlements) {
  // Current members first; anyone else the money mentions (people who left the
  // trip) gets a row too, so their debts don't silently disappear.
  const rows = new Map(memberIds.map((id) => [id, { userId: id, netMinor: 0, paidMinor: 0, owedMinor: 0 }]))
  const row = (id) => {
    if (!rows.has(id)) rows.set(id, { userId: id, netMinor: 0, paidMinor: 0, owedMinor: 0 })
    return rows.get(id)
  }

  for (const expense of expenses) {
    row(expense.paidBy).netMinor += expense.amountMinor
    row(expense.paidBy).paidMinor += expense.amountMinor
    for (const split of expense.splits) {
      row(split.userId).netMinor -= split.shareMinor
      row(split.userId).owedMinor += split.shareMinor
    }
  }

  // A settlement "from → to" means `from` paid back `to`.
  for (const s of settlements) {
    row(s.fromUser).netMinor += s.amountMinor
    row(s.toUser).netMinor -= s.amountMinor
  }

  return [...rows.values()]
}

/**
 * Greedy matching of the largest debtor with the largest creditor.
 * Produces at most n − 1 payments.
 */
export function simplifyDebts(balances) {
  const creditors = balances.filter((b) => b.netMinor > 0).map((b) => ({ ...b }))
  const debtors = balances.filter((b) => b.netMinor < 0).map((b) => ({ ...b, netMinor: -b.netMinor }))
  const payments = []

  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.netMinor - a.netMinor)
    debtors.sort((a, b) => b.netMinor - a.netMinor)
    const creditor = creditors[0]
    const debtor = debtors[0]
    const amount = Math.min(creditor.netMinor, debtor.netMinor)

    payments.push({ fromUser: debtor.userId, toUser: creditor.userId, amountMinor: amount })
    creditor.netMinor -= amount
    debtor.netMinor -= amount
    if (creditor.netMinor === 0) creditors.shift()
    if (debtor.netMinor === 0) debtors.shift()
  }

  return payments
}
