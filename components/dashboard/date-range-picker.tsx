'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDateRangeStore, type PresetKey } from '@/lib/stores/date-range'

const PRESETS: { label: string; key: PresetKey }[] = [
  { label: 'Últimos 7 dias',  key: 'last7' },
  { label: 'Últimos 14 dias', key: 'last14' },
  { label: 'Últimos 30 dias', key: 'last30' },
  { label: 'Este mês',        key: 'thisMonth' },
  { label: 'Mês passado',     key: 'lastMonth' },
]

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

function formatDate(date: Date): string {
  return fmt.format(date)
}

export function DateRangePicker() {
  const { from, to, setRange, applyPreset } = useDateRangeStore()
  const [open, setOpen] = useState(false)

  function handleSelect(range: DayPickerDateRange | undefined) {
    if (range?.from && range?.to) {
      setRange({ from: range.from, to: range.to })
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="gap-2 text-xs h-8" />
        }
      >
        <CalendarIcon className="size-3.5" />
        {formatDate(from)} – {formatDate(to)}
      </PopoverTrigger>
      <PopoverContent
        className="flex gap-0 p-0 w-auto"
        align="end"
      >
        <div className="flex flex-col border-r border-border p-2 gap-1 min-w-[148px]">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className="text-xs text-left px-3 py-1.5 rounded hover:bg-accent cursor-pointer"
              onClick={() => {
                applyPreset(p.key)
                setOpen(false)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={{ from, to }}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
