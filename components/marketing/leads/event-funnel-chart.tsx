'use client'

import { useMemo } from 'react'
import { GroupedVBarChart } from '@/components/marketing/charts/dashboard-charts'
import { Panel } from '@/components/marketing/ui/panel'
import { leadBucket, isSql } from '@/lib/leads'
import { CalendarDays } from 'lucide-react'

interface LeadLite { data_source: string | null; lead_source: string | null; meeting_outcome?: string | null }

export default function EventFunnelChart({ leads }: { leads: LeadLite[] }) {
  const { data, totalMql, totalSql } = useMemo(() => {
    const m = new Map<string, { MQL: number; SQL: number }>()
    for (const l of leads) {
      if (leadBucket(l.lead_source ?? '') !== 'Event') continue
      const ev = (l.data_source ?? '').trim() || 'Unlabelled'
      const r = m.get(ev) ?? { MQL: 0, SQL: 0 }
      r.MQL++
      if (isSql(l)) r.SQL++
      m.set(ev, r)
    }
    const rows = [...m.entries()]
      .map(([name, v]) => ({ name, MQL: v.MQL, SQL: v.SQL }))
      .sort((a, b) => b.MQL - a.MQL)
    return {
      data: rows,
      totalMql: rows.reduce((s, d) => s + d.MQL, 0),
      totalSql: rows.reduce((s, d) => s + d.SQL, 0),
    }
  }, [leads])

  return (
    <Panel
      icon={CalendarDays}
      title="Event MQL + SQL"
      accent="amber"
      caption={`${data.length} events · ${totalMql} MQL · ${totalSql} SQL · MQL = every event lead, SQL = completed meeting`}
    >
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(data.length * 70, 320) }}>
          <GroupedVBarChart
            data={data}
            series={[
              { key: 'MQL', label: 'MQL', color: '#6366f1' },
              { key: 'SQL', label: 'SQL', color: '#10b981' },
            ]}
          />
        </div>
      </div>
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
