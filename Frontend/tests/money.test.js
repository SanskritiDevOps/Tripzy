import { describe, expect, it } from 'vitest'
import { buildSplits, formatMoney, splitEqual, splitPercent, toInputValue, toMinor } from '../src/utils/money'

const total = (splits) => splits.reduce((sum, s) => sum + s.shareMinor, 0)

describe('formatting and parsing amounts', () => {
  it('formats paise as rupees, dropping decimals for whole amounts', () => {
    expect(formatMoney(123450)).toBe('₹1,234.50')
    expect(formatMoney(120000)).toBe('₹1,200')
    expect(formatMoney(12_345_600)).toBe('₹1,23,456') // Indian digit grouping
  })

  it('parses typed amounts into paise and rejects anything ambiguous', () => {
    expect(toMinor('1,234.5')).toBe(123450)
    expect(toMinor('₹ 99')).toBe(9900)
    expect(toMinor('0.07')).toBe(7)
    expect(toMinor('12.345')).toBeNaN()
    expect(toMinor('-5')).toBeNaN()
    expect(toMinor('abc')).toBeNaN()
  })

  it('round-trips through the input field format', () => {
    for (const minor of [100, 123450, 7, 120000]) expect(toMinor(toInputValue(minor))).toBe(minor)
    expect(toInputValue(0)).toBe('')
  })
})

describe('splitting an expense', () => {
  it('equal splits always add up; leftover paise go to the first people', () => {
    expect(splitEqual(10000, ['a', 'b', 'c']).map((s) => s.shareMinor)).toEqual([3334, 3333, 3333])
    for (const amount of [1, 99, 100_001, 9_999_999]) expect(total(splitEqual(amount, ['a', 'b', 'c', 'd', 'e', 'f', 'g']))).toBe(amount)
  })

  it('percentage splits add up exactly, even with thirds', () => {
    const splits = splitPercent(10000, [
      { userId: 'a', percent: 33.33 },
      { userId: 'b', percent: 33.33 },
      { userId: 'c', percent: 33.34 },
    ])
    expect(total(splits)).toBe(10000)
  })

  it('rejects exact shares that do not add up to the amount', () => {
    const result = buildSplits({ amountMinor: 10000, splitType: 'EXACT', participants: [{ userId: 'a', value: '60' }, { userId: 'b', value: '30' }] })
    expect(result.error).toBe('Shares add up to ₹90, but the expense is ₹100.')
  })

  it('rejects percentages that do not total 100%', () => {
    const result = buildSplits({ amountMinor: 10000, splitType: 'PERCENT', participants: [{ userId: 'a', value: '50' }, { userId: 'b', value: '40' }] })
    expect(result.error).toMatch(/90%/)
  })

  it('leaves people with a zero share out of the splits', () => {
    const { splits } = buildSplits({ amountMinor: 5000, splitType: 'EXACT', participants: [{ userId: 'a', value: '50' }, { userId: 'b', value: '' }] })
    expect(splits).toEqual([{ userId: 'a', shareMinor: 5000 }])
  })

  it('needs a positive amount and at least one person', () => {
    expect(buildSplits({ amountMinor: 0, splitType: 'EQUAL', participants: [{ userId: 'a' }] }).error).toBeTruthy()
    expect(buildSplits({ amountMinor: 100, splitType: 'EQUAL', participants: [] }).error).toBeTruthy()
  })
})
