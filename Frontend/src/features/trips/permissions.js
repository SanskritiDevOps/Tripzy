// What the current user may do on a trip. Mirrors the backend permission
// matrix (Backend/src/modules/trips/trips.routes.js); the API enforces it,
// these helpers only decide what the UI offers.

export const ROLE_LABELS = { LEADER: 'Team Leader', MEMBER: 'Member' }

export function getTripPermissions(role) {
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
    /** Itinerary stops are protected by their own lock and by their place's lock. */
    canEditStop: (item, place) => isLeader || (isMember && !item?.isLocked && !place?.isLocked),
  }
}
