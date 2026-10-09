// Balances and debt simplification — README §10.2.

/**
 * Net balance per member = total paid − total owed (+ settlements).
 * Positive → should receive money, negative → should pay.
 */
export function computeBalances(memberIds, expenses, settlements) {
  const net = Object.fromEntries(memberIds.map((id) => [id, 0]))
  const paid = Object.fromEntries(memberIds.map((id) => [id, 0]))
  const owed = Object.fromEntries(memberIds.map((id) => [id, 0]))

  for (const expense of expenses) {
    if (expense.paidBy in net) {
      net[expense.paidBy] += expense.amountMinor
      paid[expense.paidBy] += expense.amountMinor
    }
    for (const split of expense.splits) {
      if (split.userId in net) {
        net[split.userId] -= split.shareMinor
        owed[split.userId] += split.shareMinor
      }
    }
  }

  // A settlement "from → to" means `from` paid back `to`.
  for (const s of settlements) {
    if (s.fromUser in net) net[s.fromUser] += s.amountMinor
    if (s.toUser in net) net[s.toUser] -= s.amountMinor
  }

  return memberIds.map((userId) => ({ userId, netMinor: net[userId], paidMinor: paid[userId], owedMinor: owed[userId] }))
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
