import { describe, expect, it } from 'vitest'
import { getTripPermissions } from '../src/features/trips/permissions'

const leader = getTripPermissions('LEADER', 'lead')
const member = getTripPermissions('MEMBER', 'me')
const outsider = getTripPermissions(undefined, 'stranger')

describe('trip permissions (what the UI offers)', () => {
  it('only the leader manages the budget, invites, voting and members', () => {
    for (const key of ['canSetBudget', 'canInvite', 'canManageVoting', 'canRemoveMembers', 'canDeleteTrip', 'canLockPlace']) {
      expect(leader[key]).toBe(true)
      expect(member[key]).toBe(false)
    }
  })

  it('members edit places and stops unless they are locked', () => {
    expect(member.canEditPlace({ isLocked: false })).toBe(true)
    expect(member.canEditPlace({ isLocked: true })).toBe(false)
    expect(leader.canEditPlace({ isLocked: true })).toBe(true)
    expect(member.canEditStop({ isLocked: false }, { isLocked: true })).toBe(false) // the place is locked
    expect(member.canEditStop({ isLocked: true }, { isLocked: false })).toBe(false) // the time slot is locked
  })

  it('expenses and packing items can be changed by whoever added them, or the leader', () => {
    expect(member.canEditExpense({ createdBy: 'me' })).toBe(true)
    expect(member.canEditExpense({ createdBy: 'someone-else' })).toBe(false)
    expect(leader.canEditExpense({ createdBy: 'someone-else' })).toBe(true)
    expect(member.canDeletePackingItem({ addedBy: 'someone-else' })).toBe(false)
  })

  it('a payment can be recorded by the payer, the receiver or the leader', () => {
    expect(member.canRecordSettlement({ fromUser: 'me', toUser: 'x' })).toBe(true)
    expect(member.canRecordSettlement({ fromUser: 'x', toUser: 'me' })).toBe(true)
    expect(member.canRecordSettlement({ fromUser: 'x', toUser: 'y' })).toBe(false)
  })

  it('someone who is not on the trip can do nothing', () => {
    expect(outsider.canAddPlace).toBe(false)
    expect(outsider.canEditPlace({ isLocked: false })).toBe(false)
  })
})
