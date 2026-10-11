// What the current user may do on a trip. Mirrors the backend permission
// matrix (Backend/src/modules/trips/trips.routes.js); the API enforces it,
// these helpers only decide what the UI offers.

export const ROLE_LABELS = { LEADER: 'Team Leader', MEMBER: 'Member' }

export function getTripPermissions(role, currentUserId) {
  const isLeader = role === 'LEADER'
  const isMember = role === 'MEMBER'
  return {
    role,
    isLeader,
    isMember,
    // Both roles
    canEditTripDetails: isLeader || isMember,
    canAddPlace: isLeader || isMember,
    // Leader only
    canLockPlace: isLeader,
    canSetBudget: isLeader,
    canDeleteTrip: isLeader,
    canInvite: isLeader,
    canRemoveMembers: isLeader,
    canManageVoting: isLeader,
    /** Locked places can only be edited or deleted by the leader. */
    canEditPlace: (place) => Boolean(place) && (isLeader || ((isMember) && !place.isLocked)),
    /** Expenses: whoever added it, or the leader. (Bundled demo expenses have no creator.) */
    canEditExpense: (expense) => isLeader || (isMember && (!expense?.createdBy || expense.createdBy === currentUserId)),
    /** Settlements: the payer, the receiver, or the leader. */
    canRecordSettlement: (payment) => isLeader || payment?.fromUser === currentUserId || payment?.toUser === currentUserId,
    /** Packing: anyone ticks; deleting is for whoever added the item, or the leader. */
    canDeletePackingItem: (item) => isLeader || (isMember && (!item?.addedBy || item.addedBy === currentUserId)),
    /** Itinerary stops are protected by their own lock and by their place's lock. */
    canEditStop: (item, place) => isLeader || (isMember && !item?.isLocked && !place?.isLocked),
  }
}
