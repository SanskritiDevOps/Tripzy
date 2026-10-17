import { describe, expect, it } from 'vitest'
import { computeBalances, simplifyDebts } from '../src/utils/settlements'

const expense = (paidBy, amountMinor, shares) => ({ paidBy, amountMinor, splits: Object.entries(shares).map(([userId, shareMinor]) => ({ userId, shareMinor })) })
const net = (balances) => Object.fromEntries(balances.map((b) => [b.userId, b.netMinor]))

describe('balances', () => {
  it('is what each person paid minus what they owe', () => {
    const balances = computeBalances(['a', 'b', 'c'], [expense('a', 9000, { a: 3000, b: 3000, c: 3000 })], [])
    expect(net(balances)).toEqual({ a: 6000, b: -3000, c: -3000 })
  })

  it('counts recorded payments', () => {
    const balances = computeBalances(['a', 'b'], [expense('a', 4000, { a: 2000, b: 2000 })], [{ fromUser: 'b', toUser: 'a', amountMinor: 2000 }])
    expect(net(balances)).toEqual({ a: 0, b: 0 })
  })

  it('keeps a row for someone who has left the trip, so their debt does not vanish', () => {
    const balances = computeBalances(['a'], [expense('a', 2000, { a: 1000, gone: 1000 })], [])
    expect(net(balances)).toEqual({ a: 1000, gone: -1000 })
  })
})

describe('simplified settle-up', () => {
  it('clears every balance in at most n − 1 payments', () => {
    const balances = computeBalances(
      ['a', 'b', 'c', 'd', 'e'],
      [
        expense('a', 10000, { a: 2000, b: 2000, c: 2000, d: 2000, e: 2000 }),
        expense('b', 4500, { c: 1500, d: 1500, e: 1500 }),
        expense('e', 3000, { a: 1000, b: 1000, c: 1000 }),
      ],
      [],
    )
    const payments = simplifyDebts(balances)
    expect(payments.length).toBeLessThanOrEqual(balances.length - 1)

    const after = computeBalances(['a', 'b', 'c', 'd', 'e'], [], payments)
    const settled = Object.fromEntries(Object.entries(net(balances)).map(([id, value]) => [id, value + net(after)[id]]))
    expect(Object.values(settled).every((v) => v === 0)).toBe(true)
  })

  it('needs no payments when everyone is even', () => {
    expect(simplifyDebts(computeBalances(['a', 'b'], [expense('a', 2000, { a: 2000 })], []))).toEqual([])
  })
})
