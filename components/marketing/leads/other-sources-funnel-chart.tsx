'use client'

import { useMemo } from 'react'
import { GroupedVBarChart } from '@/components/marketing/charts/dashboard-charts'
import { Panel } from '@/components/marketing/ui/panel'
import { Layers } from 'lucide-react'

interface LeadLite { lead_source: string | null; lead_status: string | null }

export default function OtherSourcesFunnelChart({ leads }: { leads: LeadLite[] }) {
  const { data, totalMql, totalSql } = useMemo(() => {
    const nonEvent = leads.filter(l => l.lead_source && l.lead_source !== 'Event')

    const sourceCounts = nonEvent.reduce<Record<string, { MQL: number; SQL: number }>>((acc, l) => {
      const src = l.lead_source!
      if (!acc[src]) acc[src] = { MQL: 0, SQL: 0 }
      if (l.lead_status === 'MQL') acc[src].MQL++
      if (l.lead_status === 'SQL') acc[src].SQL++
      return acc
    }, {})

    const rows = Object.entries(sourceCounts)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => (b.MQL + b.SQL) - (a.MQL + a.SQL))

    return {
      data: rows,
      totalMql: rows.reduce((s, d) => s + d.MQL, 0),
      totalSql: rows.reduce((s, d) => s + d.SQL, 0),
    }
  }, [leads])

  if (data.length === 0) return null

  return (
    <Panel
      icon={Layers}
      title="MQL + SQL by Other Sources"
      accent="violet"
      caption={`${data.length} source${data.length === 1 ? '' : 's'} · ${totalMql} MQL · ${totalSql} SQL · ${totalMql + totalSql} total`}
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
