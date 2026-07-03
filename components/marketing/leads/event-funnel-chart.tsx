'use client'

import { useMemo } from 'react'
import { GroupedVBarChart } from '@/components/marketing/charts/dashboard-charts'
import { Panel } from '@/components/marketing/ui/panel'
import { CalendarDays } from 'lucide-react'

const EVENT_NAMES = ['SNH 2026', 'AICPA 2026', 'NJCPA 2026', 'TXCPA 2026']

interface LeadLite { data_source: string | null; lead_status: string | null }

export default function EventFunnelChart({ leads }: { leads: LeadLite[] }) {
  const { data, totalMql, totalSql } = useMemo(() => {
    const rows = EVENT_NAMES.map(event => ({
      name: event,
      MQL: leads.filter(l => l.data_source?.trim() === event && l.lead_status === 'MQL').length,
      SQL: leads.filter(l => l.data_source?.trim() === event && l.lead_status === 'SQL').length,
    }))
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
      caption={`SNH · AICPA · NJCPA · TXCPA · ${totalMql} MQL · ${totalSql} SQL · ${totalMql + totalSql} total`}
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
