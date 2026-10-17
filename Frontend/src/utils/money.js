// All money is handled as integers in minor units (paise / cents), never floats.

const formatters = new Map()

function getFormatter(currency, fractionDigits) {
  const key = `${currency}:${fractionDigits}`
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    )
  }
  return formatters.get(key)
}

/** 123450 → "₹1,234.50"; whole amounts drop the decimals ("₹1,200"). */
export function formatMoney(minor, currency = 'INR') {
  const value = Number(minor) || 0
  const digits = value % 100 === 0 ? 0 : 2
  return getFormatter(currency, digits).format(value / 100)
}

/** Compact form for tight spaces: 1250000 → "₹12.5K". */
export function formatMoneyCompact(minor, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format((Number(minor) || 0) / 100)
}

/** Parses user input like "1,234.5" into minor units (123450). Returns NaN when invalid. */
export function toMinor(input) {
  if (typeof input === 'number') return Math.round(input * 100)
  const cleaned = String(input ?? '').replace(/[,\s₹]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return NaN
  const [whole, fraction = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Minor units → plain input string ("1234.50" / "1200"). */
export function toInputValue(minor) {
  if (!minor) return ''
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
}

/**
 * Equal split. Remainder paise go to the first people in the given order,
 * so ₹100 between 3 people → 3334, 3333, 3333.
 */
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

/**
 * Percentage split. Percentages may have up to 2 decimals and must total 100.
 * Works in basis points to stay in integer math; leftover paise go to the first people.
 */
export function splitPercent(totalMinor, entries) {
  const withBp = entries.map((e) => ({ userId: e.userId, bp: Math.round(Number(e.percent) * 100) }))
  const shares = withBp.map((e) => ({ userId: e.userId, shareMinor: Math.floor((totalMinor * e.bp) / 10000) }))
  let remainder = totalMinor - shares.reduce((sum, s) => sum + s.shareMinor, 0)
  if (!withBp.some((e) => e.bp > 0)) return shares
  for (let i = 0; remainder > 0 && shares.length > 0; i = (i + 1) % shares.length) {
    if (withBp[i].bp > 0) {
      shares[i].shareMinor += 1
      remainder -= 1
    }
  }
  return shares
}

function sumMinor(items, key = 'shareMinor') {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0)
}

/**
 * Builds and validates splits for an expense. Returns { splits } or { error }.
 * `participants` is [{ userId, value }] where value is the exact amount string or percentage.
 */
export function buildSplits({ amountMinor, splitType, participants }) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return { error: 'Enter an amount greater than zero.' }
  if (participants.length === 0) return { error: 'Pick at least one person to share this expense.' }

  if (splitType === 'EQUAL') {
    return { splits: splitEqual(amountMinor, participants.map((p) => p.userId)) }
  }

  if (splitType === 'EXACT') {
    const splits = participants.map((p) => ({ userId: p.userId, shareMinor: toMinor(p.value || '0') }))
    if (splits.some((s) => Number.isNaN(s.shareMinor))) return { error: 'Every share must be a valid amount.' }
    const total = sumMinor(splits)
    if (total !== amountMinor) {
      return { error: `Shares add up to ${formatMoney(total)}, but the expense is ${formatMoney(amountMinor)}.` }
    }
    return { splits: splits.filter((s) => s.shareMinor > 0) }
  }

  if (splitType === 'PERCENT') {
    const entries = participants.map((p) => ({ userId: p.userId, percent: Number(p.value || 0) }))
    if (entries.some((e) => Number.isNaN(e.percent) || e.percent < 0)) return { error: 'Percentages must be positive numbers.' }
    const totalBp = entries.reduce((sum, e) => sum + Math.round(e.percent * 100), 0)
    if (totalBp !== 10000) return { error: `Percentages add up to ${totalBp / 100}%, they need to total 100%.` }
    return { splits: splitPercent(amountMinor, entries).filter((s) => s.shareMinor > 0) }
  }

  return { error: 'Unknown split type.' }
}
