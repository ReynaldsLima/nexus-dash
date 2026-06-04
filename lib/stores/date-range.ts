import { create } from 'zustand'

export type PresetKey = 'last7' | 'last14' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'

export type DateRange = { from: Date; to: Date }

type DateRangeStore = {
  from: Date
  to: Date
  setRange: (range: DateRange) => void
  applyPreset: (preset: PresetKey) => void
}

export function getPresetRange(preset: Exclude<PresetKey, 'custom'>): DateRange {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case 'last7':
      return { from: new Date(today.getTime() - 6 * 86400000), to: today }
    case 'last14':
      return { from: new Date(today.getTime() - 13 * 86400000), to: today }
    case 'last30':
      return { from: new Date(today.getTime() - 29 * 86400000), to: today }
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today }
    case 'lastMonth': {
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLast = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: firstOfLast, to: lastOfLast }
    }
  }
}

export const useDateRangeStore = create<DateRangeStore>((set) => ({
  ...getPresetRange('last30'), // default: Last 30 days (DASH-04)
  setRange: (range) => set(range),
  applyPreset: (preset) => {
    if (preset !== 'custom') set(getPresetRange(preset))
  },
}))
