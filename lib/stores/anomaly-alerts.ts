import { create } from 'zustand'

type AnomalyAlertsStore = {
  unread: number
  increment: () => void
  clearUnread: () => void
}

export const useAnomalyAlertsStore = create<AnomalyAlertsStore>((set) => ({
  unread: 0,
  increment: () => set((s) => ({ unread: s.unread + 1 })),
  clearUnread: () => set({ unread: 0 }),
}))
