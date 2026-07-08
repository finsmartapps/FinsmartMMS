'use client'

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import WeeklyFunnelChart from './weekly-funnel-chart'
import EventFunnelChart from './event-funnel-chart'
import OtherSourcesFunnelChart from './other-sources-funnel-chart'
import SourceFunnelChart from './source-funnel-chart'

type FilterMode = 'week' | 'month' | 'last-month' | 'year' | 'pick-month' | 'custom'

const OPTIONS: { mode: FilterMode; label: string }[] = [
  { mode: 'week',       label: 'This Week'    },
  { mode: 'month',      label: 'This Month'   },
  { mode: 'last-month', label: 'Last Month'   },
  { mode: 'year',       label: 'This Year'    },
  { mode: 'pick-month', label: 'Select Month' },
  { mode: 'custom',     label: 'Date Range'   },
]

interface LeadLite {
  lead_date:        string | null
  lead_status:      string | null
  lead_source:      string | null
  data_source:      string | null
  lead_stage:       string | null
  customer_type:    string | null
  mrr_value:        number | null
  one_time_revenue: number | null
  name:             string | null
  company_name:     string | null
  assigned_to:      string | null
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getRange(mode: FilterMode, pickMonth: string, from: string, to: string) {
  const today = new Date()
  if (mode === 'week') {
    const day = today.getDay()
    const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: isoDate(mon), to: isoDate(sun) }
  }
  if (mode === 'month') {
    const y = today.getFullYear(), m = today.getMonth()
    return {
      from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to:   `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
    }
  }
  if (mode === 'last-month') {
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const y = prev.getFullYear(), m = prev.getMonth()
    return {
      from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to:   `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
    }
  }
  if (mode === 'year') {
    const y = today.getFullYear()
    return { from: `${y}-01-01`, to: isoDate(today) }
  }
  if (mode === 'pick-month' && pickMonth) {
    const [y, m] = pickMonth.split('-').map(Number)
    return { from: `${pickMonth}-01`, to: `${pickMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }
  }
  if (mode === 'custom') return { from: from || '2000-01-01', to: to || '2099-12-31' }
  return { from: '2000-01-01', to: '2099-12-31' }
}

function defaultPickMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function LeadsFunnelSection({ leads }: { leads: LeadLite[] }) {
  const [mode, setMode] = useState<FilterMode>('year')
  const [pickMonth, setPickMonth] = useState(defaultPickMonth)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [open, setOpen] = useState(false)

  const range = useMemo(
    () => getRange(mode, pickMonth, customFrom, customTo),
    [mode, pickMonth, customFrom, customTo],
  )

  const filtered = useMemo(
    () => leads.filter(l => { const d = l.lead_date ?? ''; return d >= range.from && d <= range.to }),
    [leads, range],
  )

  const currentLabel = OPTIONS.find(o => o.mode === mode)?.label ?? 'This Month'

  return (
    <div className="space-y-4">
      {/* ── Shared filter dropdown ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
          >
            {currentLabel}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg overflow-hidden min-w-[144px]">
              {OPTIONS.map(o => (
                <button
                  key={o.mode}
                  onClick={() => { setMode(o.mode); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                    mode === o.mode ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'pick-month' && (
          <input
            type="month"
            value={pickMonth}
            onChange={e => setPickMonth(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        )}

        {mode === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
            <span className="text-xs text-slate-400 font-medium">to</span>
            <input
              type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>
        )}
      </div>

      {/* ── Charts — all driven by the same filter ── */}
      <WeeklyFunnelChart
        leads={filtered.map(l => ({ lead_date: l.lead_date, lead_status: l.lead_status }))}
        range={range}
      />
      <EventFunnelChart
        leads={filtered.map(l => ({ data_source: l.data_source, lead_status: l.lead_status }))}
      />
      <OtherSourcesFunnelChart
        leads={filtered.map(l => ({ lead_source: l.lead_source, lead_status: l.lead_status }))}
      />
      <SourceFunnelChart
        leads={filtered.map(l => ({
          lead_source:      l.lead_source,
          lead_status:      l.lead_status,
          lead_stage:       l.lead_stage,
          customer_type:    l.customer_type,
          mrr_value:        l.mrr_value,
          one_time_revenue: l.one_time_revenue,
          name:             l.name,
          company_name:     l.company_name,
          assigned_to:      l.assigned_to,
          lead_date:        l.lead_date,
        }))}
      />
    </div>
  )
}
