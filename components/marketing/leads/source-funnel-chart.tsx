'use client'

import { useMemo } from 'react'
import { Panel } from '@/components/marketing/ui/panel'
import { GitMerge } from 'lucide-react'
import { classifyLeadSource, CATEGORY_STYLES } from '@/lib/leads'

interface LeadLite {
  lead_source:      string | null
  lead_status:      string | null
  customer_type:    string | null
  mrr_value:        number | null
  one_time_revenue: number | null
}

function isClosed(l: LeadLite) {
  return l.lead_status === 'SQL' && ((l.mrr_value ?? 0) > 0 || (l.one_time_revenue ?? 0) > 0)
}

export default function SourceFunnelChart({ leads }: { leads: LeadLite[] }) {
  const rows = useMemo(() => {
    const map: Record<string, { total: number; mql: number; sql: number; nbec: number; nbnc: number; other: number }> = {}

    for (const l of leads) {
      const src = l.lead_source?.trim() || 'Unspecified'
      if (!map[src]) map[src] = { total: 0, mql: 0, sql: 0, nbec: 0, nbnc: 0, other: 0 }
      map[src].total++
      if (l.lead_status === 'MQL') map[src].mql++
      if (l.lead_status === 'SQL') map[src].sql++
      if (isClosed(l)) {
        const ct = (l.customer_type ?? '').trim().toUpperCase()
        if (ct === 'NBEC')      map[src].nbec++
        else if (ct === 'NBNC') map[src].nbnc++
        else                    map[src].other++
      }
    }

    return Object.entries(map)
      .map(([source, c]) => ({ source, category: classifyLeadSource(source), ...c, customers: c.nbec + c.nbnc + c.other }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  if (rows.length === 0) return null

  const totals = rows.reduce(
    (acc, r) => ({
      total:     acc.total     + r.total,
      mql:       acc.mql       + r.mql,
      sql:       acc.sql       + r.sql,
      customers: acc.customers + r.customers,
      nbec:      acc.nbec      + r.nbec,
      nbnc:      acc.nbnc      + r.nbnc,
    }),
    { total: 0, mql: 0, sql: 0, customers: 0, nbec: 0, nbnc: 0 },
  )

  return (
    <Panel
      icon={GitMerge}
      title="Funnel by Lead Source"
      accent="indigo"
      noPad
      caption="Total → MQL / SQL → Closed (SQL + revenue) · NBEC = existing customer · NBNC = new customer"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
            <tr>
              <th className="px-4 py-2.5 text-left   font-bold text-slate-400 uppercase tracking-wider">Lead Source</th>
              <th className="px-4 py-2.5 text-right  font-bold text-slate-400 uppercase tracking-wider">Total</th>
              <th className="px-4 py-2.5 text-right  font-bold text-indigo-400 uppercase tracking-wider">MQL</th>
              <th className="px-4 py-2.5 text-right  font-bold text-emerald-500 uppercase tracking-wider">SQL</th>
              <th className="px-4 py-2.5 text-right  font-bold text-amber-500 uppercase tracking-wider">NBEC</th>
              <th className="px-4 py-2.5 text-right  font-bold text-fuchsia-500 uppercase tracking-wider">NBNC</th>
              <th className="px-4 py-2.5 text-right  font-bold text-fuchsia-600 uppercase tracking-wider">Closed</th>
              <th className="px-4 py-2.5 text-right  font-bold text-fuchsia-600 uppercase tracking-wider pr-5">Conv %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => {
              const mqlPct  = r.total > 0 ? Math.round((r.mql       / r.total) * 100) : 0
              const sqlPct  = r.total > 0 ? Math.round((r.sql       / r.total) * 100) : 0
              const custPct = r.total > 0 ? (r.customers / r.total) * 100 : 0
              const style   = CATEGORY_STYLES[r.category] ?? CATEGORY_STYLES['Digital MQL']

              return (
                <tr key={r.source} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${style.badge}`}>{r.category}</span>
                      {r.source}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700 tabular-nums">{r.total}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-semibold text-indigo-700">{r.mql}</span>
                    {r.mql > 0 && <span className="text-slate-400 ml-1">({mqlPct}%)</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-semibold text-emerald-700">{r.sql}</span>
                    {r.sql > 0 && <span className="text-slate-400 ml-1">({sqlPct}%)</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.nbec > 0
                      ? <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{r.nbec}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.nbnc > 0
                      ? <span className="font-bold text-fuchsia-700 bg-fuchsia-50 px-1.5 py-0.5 rounded">{r.nbnc}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-fuchsia-700 tabular-nums">{r.customers}</td>
                  <td className="px-4 py-3 pr-5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                          style={{ width: `${Math.min(custPct, 100)}%` }}
                        />
                      </div>
                      <span className="font-bold text-fuchsia-700 w-10 text-right">{custPct.toFixed(1)}%</span>
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
              <td className="px-4 py-2.5 text-right font-bold text-amber-600 tabular-nums">{totals.nbec}</td>
              <td className="px-4 py-2.5 text-right font-bold text-fuchsia-700 tabular-nums">{totals.nbnc}</td>
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
