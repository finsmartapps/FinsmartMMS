'use client'

import { useMemo, useState } from 'react'
import { GroupedVBarChart } from '@/components/marketing/charts/dashboard-charts'
import { Panel } from '@/components/marketing/ui/panel'
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'

interface LeadLite { lead_date: string | null; lead_status: string | null }

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mondayOf(d: Date) {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
  return x
}
function weekLabel(mon: Date) {
  return mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtRange(from: Date, to: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${from.toLocaleDateString('en-US', opts)} – ${to.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

const WEEKS = 12

export default function WeeklyFunnelChart({ leads }: { leads: LeadLite[] }) {
  const [offset, setOffset] = useState(0) // 0 = current window, 1 = one page back, etc.

  const { data, rangeFrom, rangeTo } = useMemo(() => {
    const thisMon = mondayOf(new Date())
    const anchor = new Date(thisMon)
    anchor.setDate(thisMon.getDate() - offset * WEEKS * 7)

    const weeks = Array.from({ length: WEEKS }, (_, i) => {
      const mon = new Date(anchor)
      mon.setDate(anchor.getDate() - (WEEKS - 1 - i) * 7)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      const from = isoDate(mon)
      const to   = isoDate(sun)
      const week = leads.filter(l => (l.lead_date ?? '') >= from && (l.lead_date ?? '') <= to)
      return {
        name: weekLabel(mon),
        MQL:  week.filter(l => l.lead_status === 'MQL').length,
        SQL:  week.filter(l => l.lead_status === 'SQL').length,
      }
    })

    const firstMon = new Date(anchor)
    firstMon.setDate(anchor.getDate() - (WEEKS - 1) * 7)
    const lastSun = new Date(anchor)
    lastSun.setDate(anchor.getDate() + 6)

    return { data: weeks, rangeFrom: firstMon, rangeTo: lastSun }
  }, [leads, offset])

  const totalMql = data.reduce((s, d) => s + d.MQL, 0)
  const totalSql = data.reduce((s, d) => s + d.SQL, 0)

  return (
    <Panel
      icon={TrendingUp}
      title="Weekly MQL + SQL"
      accent="indigo"
      caption={`${fmtRange(rangeFrom, rangeTo)} · ${totalMql} MQL · ${totalSql} SQL · ${totalMql + totalSql} total`}
    >
      <GroupedVBarChart
        data={data}
        series={[
          { key: 'MQL', label: 'MQL', color: '#6366f1' },
          { key: 'SQL', label: 'SQL', color: '#10b981' },
        ]}
      />
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-indigo-500" /> MQL
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-emerald-500" /> SQL
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset(o => o + 1)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={() => setOffset(o => o - 1)}
            disabled={offset === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Panel>
  )
}
