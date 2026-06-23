'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'

export type Period = 'today' | 'week' | 'month' | 'year' | 'custom'

export interface DateRange {
  from: string
  to: string
}

interface Props {
  value: { period: Period; from: string; to: string }
  onChange: (range: DateRange) => void
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export function getPeriodDates(period: Period): DateRange {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  if (period === 'today') return { from: todayStr, to: todayStr }

  if (period === 'week') {
    const dow = today.getDay()
    const offset = dow === 0 ? -6 : 1 - dow
    const mon = new Date(today); mon.setDate(today.getDate() + offset)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] }
  }

  if (period === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    return { from, to: todayStr }
  }

  if (period === 'year') {
    const from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0]
    return { from, to: todayStr }
  }

  return { from: todayStr, to: todayStr }
}

const PRESETS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year',  label: 'This Year' },
  { key: 'custom', label: 'Custom' },
]

export function PeriodSelector({ value, onChange }: Props) {
  const [customFrom, setCustomFrom] = useState(value.from)
  const [customTo, setCustomTo] = useState(value.to)

  function selectPreset(p: Period) {
    if (p === 'custom') {
      // just switch UI, don't call onChange yet
      onChange({ from: value.from, to: value.to }) // keep current range
      return
    }
    const range = getPeriodDates(p)
    onChange(range)
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange({ from: customFrom, to: customTo })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset tabs */}
      <div className="flex items-center bg-[#F5F5F7] rounded-xl p-1 gap-0.5 border border-[#E5E5EA]">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              value.period === p.key
                ? 'bg-white text-[#1D1D1F] shadow-sm border border-[#E5E5EA]'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date pickers — shown when custom is active */}
      {value.period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            max={customTo || getToday()}
            onChange={e => setCustomFrom(e.target.value)}
            className="border border-[#E5E5EA] rounded-xl px-3 py-1.5 text-[13px] text-[#1D1D1F] bg-white focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
          />
          <span className="text-[#AEAEB2] text-[13px]">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={getToday()}
            onChange={e => setCustomTo(e.target.value)}
            className="border border-[#E5E5EA] rounded-xl px-3 py-1.5 text-[13px] text-[#1D1D1F] bg-white focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
          />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo || customFrom > customTo}
            className="flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#C91C1C] disabled:opacity-40 text-white text-[13px] font-semibold px-3 py-1.5 rounded-xl transition"
          >
            <CalendarDays size={13} />
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
