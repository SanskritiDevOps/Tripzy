import { api } from './client'

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
  update: (tripId, body) => api.patch(`/trips/${tripId}`, body),
  remove: (tripId) => api.delete(`/trips/${tripId}`),
  updateBudget: (tripId, budgetMinor) => api.patch(`/trips/${tripId}/budget`, { budgetMinor }),
  removeMember: (tripId, userId) => api.delete(`/trips/${tripId}/members/${userId}`),
  join: (token) => api.post('/trips/join', { token }),
}

export const placesApi = {
  list: (tripId) => api.get(`/trips/${tripId}/places`),
  create: (tripId, body) => api.post(`/trips/${tripId}/places`, body),
  update: (tripId, placeId, body) => api.patch(`/trips/${tripId}/places/${placeId}`, body),
  remove: (tripId, placeId) => api.delete(`/trips/${tripId}/places/${placeId}`),
  setLock: (tripId, placeId, locked) => api.patch(`/trips/${tripId}/places/${placeId}/lock`, { locked }),
}

export const invitesApi = {
  create: (tripId, email) => api.post(`/trips/${tripId}/invites`, { email }),
  list: (tripId) => api.get(`/trips/${tripId}/invites`),
  revoke: (tripId, inviteId) => api.delete(`/trips/${tripId}/invites/${inviteId}`),
  /** Public: works before login so the join page can show what you're joining. */
  preview: (token) => api.get(`/invites/${encodeURIComponent(token)}`, { auth: false }),
}
