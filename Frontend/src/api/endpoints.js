import { api } from './client'

export const authApi = {
  register: (body) => api.post('/auth/register', body, { auth: false }),
  login: (body) => api.post('/auth/login', body, { auth: false }),
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
  removeMember: (tripId, userId) => api.delete(`/trips/${tripId}/members/${userId}`),
}
