import { create } from 'zustand'

let counter = 0

export const useToastStore = create((set, get) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  show: (message, { tone = 'success', duration = 3200 } = {}) => {
    const id = ++counter
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), duration)
    return id
  },
}))

export const toast = {
  success: (message) => useToastStore.getState().show(message, { tone: 'success' }),
  error: (message) => useToastStore.getState().show(message, { tone: 'error', duration: 4500 }),
  info: (message) => useToastStore.getState().show(message, { tone: 'info' }),
}
