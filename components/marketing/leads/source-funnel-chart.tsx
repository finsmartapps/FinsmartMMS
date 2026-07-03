'use client'

import { useMemo } from 'react'
import { Panel } from '@/components/marketing/ui/panel'
import { GitMerge } from 'lucide-react'
import { classifyLeadSource, CATEGORY_STYLES } from '@/lib/leads'

interface LeadLite {
  lead_source:      string | null
  lead_status:      string | null
  lead_stage:       string | null
  mrr_value:        number | null
  one_time_revenue: number | null
}

export default function SourceFunnelChart({ leads }: { leads: LeadLite[] }) {
  const rows = useMemo(() => {
    const map: Record<string, { total: number; mql: number; sql: number; customers: number }> = {}

    for (const l of leads) {
      const src = l.lead_source?.trim() || 'Unspecified'
      if (!map[src]) map[src] = { total: 0, mql: 0, sql: 0, customers: 0 }
      map[src].total++
      if (l.lead_status === 'MQL') map[src].mql++
      if (l.lead_status === 'SQL') map[src].sql++
      if (l.lead_stage === 'Closed Won' && ((l.mrr_value ?? 0) > 0 || (l.one_time_revenue ?? 0) > 0))
        map[src].customers++
    }

    return Object.entries(map)
      .map(([source, c]) => ({ source, category: classifyLeadSource(source), ...c }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  if (rows.length === 0) return null

  const totals = {
    total:     rows.reduce((s, r) => s + r.total,     0),
    mql:       rows.reduce((s, r) => s + r.mql,       0),
    sql:       rows.reduce((s, r) => s + r.sql,       0),
    customers: rows.reduce((s, r) => s + r.customers, 0),
  }

  return (
    <Panel
      icon={GitMerge}
      title="Funnel by Lead Source"
      accent="indigo"
      noPad
      caption="Total leads → MQL / SQL → Customers (Closed Won with revenue) · conversion %"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
            <tr>
              <th className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider">Lead Source</th>
              <th className="px-4 py-2.5 text-right font-bold text-slate-400 uppercase tracking-wider">Total</th>
              <th className="px-4 py-2.5 text-right font-bold text-indigo-400 uppercase tracking-wider">MQL</th>
              <th className="px-4 py-2.5 text-right font-bold text-emerald-500 uppercase tracking-wider">SQL</th>
              <th className="px-4 py-2.5 text-right font-bold text-fuchsia-500 uppercase tracking-wider">Customers</th>
              <th className="px-4 py-2.5 text-right font-bold text-fuchsia-500 uppercase tracking-wider pr-5">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => {
              const mqlPct  = r.total > 0 ? Math.round((r.mql  / r.total) * 100) : 0
              const sqlPct  = r.total > 0 ? Math.round((r.sql  / r.total) * 100) : 0
              const custPct = r.total > 0 ? (r.customers / r.total) * 100 : 0
              const style   = CATEGORY_STYLES[r.category] ?? CATEGORY_STYLES['Digital MQL']

              return (
                <tr key={r.source} className="hover:bg-slate-50/70 transition-colors">
                  {/* Source */}
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${style.badge}`}>
                        {r.category}
                      </span>
                      {r.source}
                    </div>
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-right font-bold text-slate-700 tabular-nums">{r.total}</td>

                  {/* MQL */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-semibold text-indigo-700">{r.mql}</span>
                    {r.mql > 0 && <span className="text-slate-400 ml-1">({mqlPct}%)</span>}
                  </td>

                  {/* SQL */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-semibold text-emerald-700">{r.sql}</span>
                    {r.sql > 0 && <span className="text-slate-400 ml-1">({sqlPct}%)</span>}
                  </td>

                  {/* Customers */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-bold text-fuchsia-700">{r.customers}</span>
                  </td>

                  {/* Conversion bar + % */}
                  <td className="px-4 py-3 pr-5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 transition-all"
                          style={{ width: `${Math.min(custPct, 100)}%` }}
                        />
                      </div>
                      <span className="font-bold text-fuchsia-700 w-10 text-right">
                        {custPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>

          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total · {rows.length} source{rows.length === 1 ? '' : 's'}
              </td>
              <td className="px-4 py-2.5 text-right font-extrabold text-slate-800 tabular-nums">{totals.total}</td>
              <td className="px-4 py-2.5 text-right font-bold text-indigo-700 tabular-nums">{totals.mql}</td>
              <td className="px-4 py-2.5 text-right font-bold text-emerald-700 tabular-nums">{totals.sql}</td>
              <td className="px-4 py-2.5 text-right font-bold text-fuchsia-700 tabular-nums">{totals.customers}</td>
              <td className="px-4 py-2.5 pr-5 text-right font-bold text-fuchsia-700 tabular-nums">
                {totals.total > 0 ? ((totals.customers / totals.total) * 100).toFixed(1) : '0.0'}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}
