'use client'

import { useMemo } from 'react'
import { GroupedVBarChart } from '@/components/marketing/charts/dashboard-charts'
import { Panel } from '@/components/marketing/ui/panel'
import { TrendingUp } from 'lucide-react'

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

const WEEKS = 12

export default function WeeklyFunnelChart({ leads }: { leads: LeadLite[] }) {
  const data = useMemo(() => {
    const thisMon = mondayOf(new Date())
    return Array.from({ length: WEEKS }, (_, i) => {
      const mon = new Date(thisMon)
      mon.setDate(thisMon.getDate() - (WEEKS - 1 - i) * 7)
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
  }, [leads])

  const totalMql = data.reduce((s, d) => s + d.MQL, 0)
  const totalSql = data.reduce((s, d) => s + d.SQL, 0)

  return (
    <Panel
      icon={TrendingUp}
      title="Weekly MQL + SQL"
      accent="indigo"
      caption={`Last ${WEEKS} weeks · ${totalMql} MQL · ${totalSql} SQL · ${totalMql + totalSql} total`}
    >
      <GroupedVBarChart
        data={data}
        series={[
          { key: 'MQL', label: 'MQL', color: '#6366f1' },
          { key: 'SQL', label: 'SQL', color: '#10b981' },
        ]}
      />
      <div className="flex items-center gap-4 mt-1 px-1">
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
