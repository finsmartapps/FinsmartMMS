'use client'

import { useMemo } from 'react'
import { GroupedVBarChart } from '@/components/marketing/charts/dashboard-charts'
import { Panel } from '@/components/marketing/ui/panel'
import { TrendingUp } from 'lucide-react'

interface LeadLite { lead_date: string | null; lead_status: string | null }
interface Range { from: string; to: string }

function parseIso(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
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

export default function WeeklyFunnelChart({ leads, range }: { leads: LeadLite[]; range: Range }) {
  const { data, totalMql, totalSql, rangeLabel } = useMemo(() => {
    const start = mondayOf(parseIso(range.from))
    const end   = parseIso(range.to)

    const weeks: { name: string; MQL: number; SQL: number }[] = []
    const cur = new Date(start)
    while (cur <= end) {
      const from = isoDate(cur)
      const sunD = new Date(cur); sunD.setDate(cur.getDate() + 6)
      const to   = isoDate(sunD)
      const week = leads.filter(l => (l.lead_date ?? '') >= from && (l.lead_date ?? '') <= to)
      weeks.push({
        name: weekLabel(cur),
        MQL:  week.filter(l => l.lead_status === 'MQL').length,
        SQL:  week.filter(l => l.lead_status === 'SQL').length,
      })
      cur.setDate(cur.getDate() + 7)
    }

    const totalMql = weeks.reduce((s, w) => s + w.MQL, 0)
    const totalSql = weeks.reduce((s, w) => s + w.SQL, 0)

    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const rangeLabel = `${parseIso(range.from).toLocaleDateString('en-US', opts)} – ${parseIso(range.to).toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`

    return { data: weeks, totalMql, totalSql, rangeLabel }
  }, [leads, range])

  return (
    <Panel
      icon={TrendingUp}
      title="Weekly MQL + SQL"
      accent="indigo"
      caption={`${rangeLabel} · ${totalMql} MQL · ${totalSql} SQL · ${totalMql + totalSql} total`}
    >
      <GroupedVBarChart
        data={data}
        series={[
          { key: 'MQL', label: 'MQL', color: '#6366f1' },
          { key: 'SQL', label: 'SQL', color: '#10b981' },
        ]}
      />
      <div className="flex items-center gap-4 mt-2 px-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-indigo-500" /> MQL
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-emerald-500" /> SQL
        </span>
      </div>
    </Panel>
  )
}
