// Money is integers in minor units (paise), never floats.
// Same algorithms as Frontend/src/utils/money.js and settlements.js, so the
// server is the source of truth and the UI shows identical numbers.

/** Equal split; leftover paise go to the first people in order (₹100 / 3 → 3334, 3333, 3333). */
export function splitEqual(totalMinor, userIds) {
  if (userIds.length === 0) return []
  const base = Math.floor(totalMinor / userIds.length)
  let remainder = totalMinor - base * userIds.length
  return userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    return { userId, shareMinor: base + extra }
  })
}

/** Percentage split in basis points (2 decimals); leftover paise go to the first non-zero shares. */
function splitPercent(totalMinor, entries) {
  const withBp = entries.map((e) => ({ userId: e.userId, bp: Math.round(Number(e.percent) * 100) }))
  const shares = withBp.map((e) => ({ userId: e.userId, shareMinor: Math.floor((totalMinor * e.bp) / 10000) }))
  let remainder = totalMinor - shares.reduce((sum, s) => sum + s.shareMinor, 0)
  if (!withBp.some((e) => e.bp > 0)) return shares
  for (let i = 0; remainder > 0; i = (i + 1) % shares.length) {
    if (withBp[i].bp > 0) {
      shares[i].shareMinor += 1
      remainder -= 1
    }
  }
  return shares
}

/**
 * Builds the splits for an expense from `participants` ([{ userId, value }]):
 * value is ignored for EQUAL, an amount in paise for EXACT, a percentage for PERCENT.
 * Returns { splits } or { error, field }.
 */
export function buildSplits({ amountMinor, splitType, participants }) {
  if (participants.length === 0) return { error: 'Pick at least one person to share this expense.', field: 'participants' }
  const ids = participants.map((p) => p.userId)
  if (new Set(ids).size !== ids.length) return { error: 'Each person can appear only once.', field: 'participants' }

  if (splitType === 'EQUAL') return { splits: splitEqual(amountMinor, ids) }

  if (splitType === 'EXACT') {
    const splits = participants.map((p) => ({ userId: p.userId, shareMinor: p.value ?? 0 }))
    if (splits.some((s) => !Number.isInteger(s.shareMinor) || s.shareMinor < 0)) return { error: 'Every share must be a whole number of paise.', field: 'participants' }
    const total = splits.reduce((sum, s) => sum + s.shareMinor, 0)
    if (total !== amountMinor) return { error: `Shares add up to ${total} paise, but the expense is ${amountMinor} paise.`, field: 'participants' }
    return { splits: splits.filter((s) => s.shareMinor > 0) }
  }

  if (splitType === 'PERCENT') {
    const entries = participants.map((p) => ({ userId: p.userId, percent: p.value ?? 0 }))
    if (entries.some((e) => typeof e.percent !== 'number' || e.percent < 0)) return { error: 'Percentages must be positive numbers.', field: 'participants' }
    const totalBp = entries.reduce((sum, e) => sum + Math.round(e.percent * 100), 0)
    if (totalBp !== 10000) return { error: `Percentages add up to ${totalBp / 100}%, they need to total 100%.`, field: 'participants' }
    return { splits: splitPercent(amountMinor, entries).filter((s) => s.shareMinor > 0) }
  }

  return { error: 'Unknown split type.', field: 'splitType' }
}

/** Net balance per person = paid − owed (+ settlements). Positive → should receive. */
export function computeBalances(userIds, expenses, settlements) {
  const rows = Object.fromEntries(userIds.map((id) => [id, { userId: id, netMinor: 0, paidMinor: 0, owedMinor: 0 }]))
  const row = (id) => (rows[id] ??= { userId: id, netMinor: 0, paidMinor: 0, owedMinor: 0 })
  for (const e of expenses) {
    row(e.paidBy).netMinor += e.amountMinor
    row(e.paidBy).paidMinor += e.amountMinor
    for (const s of e.splits) {
      row(s.userId).netMinor -= s.shareMinor
      row(s.userId).owedMinor += s.shareMinor
    }
  }
  for (const s of settlements) {
    row(s.fromUser).netMinor += s.amountMinor
    row(s.toUser).netMinor -= s.amountMinor
  }
  return Object.values(rows)
}

/** Greedy largest-debtor ↔ largest-creditor matching: at most n − 1 payments. */
export function simplifyDebts(balances) {
  const creditors = balances.filter((b) => b.netMinor > 0).map((b) => ({ ...b }))
  const debtors = balances.filter((b) => b.netMinor < 0).map((b) => ({ ...b, netMinor: -b.netMinor }))
  const payments = []
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.netMinor - a.netMinor)
    debtors.sort((a, b) => b.netMinor - a.netMinor)
    const amount = Math.min(creditors[0].netMinor, debtors[0].netMinor)
    payments.push({ fromUser: debtors[0].userId, toUser: creditors[0].userId, amountMinor: amount })
    creditors[0].netMinor -= amount
    debtors[0].netMinor -= amount
    if (creditors[0].netMinor === 0) creditors.shift()
    if (debtors[0].netMinor === 0) debtors.shift()
  }
  return payments
}
