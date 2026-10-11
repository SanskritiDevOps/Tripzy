import { api } from './client'
import { useActivityStore } from '../store/useActivityStore'

/** Trip changes are logged server-side; refresh that trip's activity feed once the change succeeds. */
async function logged(tripId, request) {
  const result = await request
  useActivityStore.getState().refresh(tripId)
  return result
}

export const authApi = {
  register: (body) => api.post('/auth/register', body, { auth: false }),
  login: (body) => api.post('/auth/login', body, { auth: false }),
  google: (credential) => api.post('/auth/google', { credential }, { auth: false }),
  providers: () => api.get('/auth/providers', { auth: false }),
  refresh: () => api.post('/auth/refresh', undefined, { auth: false }),
  logout: () => api.post('/auth/logout', undefined, { auth: false }),
  me: () => api.get('/auth/me'),
}

export const tripsApi = {
  list: () => api.get('/trips'),
  get: (tripId) => api.get(`/trips/${tripId}`),
  create: (body) => api.post('/trips', body),
  update: (tripId, body) => logged(tripId, api.patch(`/trips/${tripId}`, body)),
  remove: (tripId) => api.delete(`/trips/${tripId}`),
  updateBudget: (tripId, budgetMinor) => logged(tripId, api.patch(`/trips/${tripId}/budget`, { budgetMinor })),
  removeMember: (tripId, userId) => logged(tripId, api.delete(`/trips/${tripId}/members/${userId}`)),
  join: (token) => api.post('/trips/join', { token }),
}

export const placesApi = {
  list: (tripId) => api.get(`/trips/${tripId}/places`),
  create: (tripId, body) => logged(tripId, api.post(`/trips/${tripId}/places`, body)),
  update: (tripId, placeId, body) => logged(tripId, api.patch(`/trips/${tripId}/places/${placeId}`, body)),
  remove: (tripId, placeId) => logged(tripId, api.delete(`/trips/${tripId}/places/${placeId}`)),
  setLock: (tripId, placeId, locked) => logged(tripId, api.patch(`/trips/${tripId}/places/${placeId}/lock`, { locked })),
  vote: (tripId, placeId, value) => logged(tripId, api.put(`/trips/${tripId}/places/${placeId}/vote`, { value })),
  unvote: (tripId, placeId) => logged(tripId, api.delete(`/trips/${tripId}/places/${placeId}/vote`)),
}

export const votingApi = {
  close: (tripId) => logged(tripId, api.post(`/trips/${tripId}/voting/close`)),
  reopen: (tripId) => logged(tripId, api.post(`/trips/${tripId}/voting/reopen`)),
}

export const itineraryApi = {
  get: (tripId) => api.get(`/trips/${tripId}/itinerary`),
  addItem: (tripId, body) => logged(tripId, api.post(`/trips/${tripId}/itinerary/items`, body)),
  updateItem: (tripId, itemId, body) => logged(tripId, api.patch(`/trips/${tripId}/itinerary/items/${itemId}`, body)),
  deleteItem: (tripId, itemId) => logged(tripId, api.delete(`/trips/${tripId}/itinerary/items/${itemId}`)),
  setLock: (tripId, itemId, locked) => logged(tripId, api.patch(`/trips/${tripId}/itinerary/items/${itemId}/lock`, { locked })),
  reorderDay: (tripId, dayId, items) => logged(tripId, api.put(`/trips/${tripId}/itinerary/days/${dayId}/order`, { items })),
  applyPlan: (tripId, body) => logged(tripId, api.post(`/trips/${tripId}/itinerary/plan`, body)),
}

export const expensesApi = {
  list: (tripId) => api.get(`/trips/${tripId}/expenses`),
  /** The Idempotency-Key makes a retried or double-clicked submit create one expense. */
  create: (tripId, body, idempotencyKey) => logged(tripId, api.post(`/trips/${tripId}/expenses`, body, { headers: { 'Idempotency-Key': idempotencyKey } })),
  update: (tripId, expenseId, body) => logged(tripId, api.patch(`/trips/${tripId}/expenses/${expenseId}`, body)),
  remove: (tripId, expenseId) => logged(tripId, api.delete(`/trips/${tripId}/expenses/${expenseId}`)),
  settle: (tripId, body) => logged(tripId, api.post(`/trips/${tripId}/settlements`, body)),
}

export const packingApi = {
  list: (tripId) => api.get(`/trips/${tripId}/packing`),
  add: (tripId, body) => logged(tripId, api.post(`/trips/${tripId}/packing`, body)),
  update: (tripId, itemId, body) => logged(tripId, api.patch(`/trips/${tripId}/packing/${itemId}`, body)),
  remove: (tripId, itemId) => logged(tripId, api.delete(`/trips/${tripId}/packing/${itemId}`)),
  reset: (tripId) => logged(tripId, api.post(`/trips/${tripId}/packing/reset`)),
}

export const invitesApi = {
  create: (tripId, email) => logged(tripId, api.post(`/trips/${tripId}/invites`, { email })),
  list: (tripId) => api.get(`/trips/${tripId}/invites`),
  revoke: (tripId, inviteId) => api.delete(`/trips/${tripId}/invites/${inviteId}`),
  /** Public: works before login so the join page can show what you're joining. */
  preview: (token) => api.get(`/invites/${encodeURIComponent(token)}`, { auth: false }),
}
