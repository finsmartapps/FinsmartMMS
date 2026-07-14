'use client'

import { useMemo, useState } from 'react'
import { Panel } from '@/components/marketing/ui/panel'
import { GitMerge, X, Briefcase, User } from 'lucide-react'
import { classifyLeadSource, CATEGORY_STYLES, formatUSD, annualContractValue } from '@/lib/leads'

interface LeadLite {
  lead_source:         string | null
  lead_status:         string | null
  lead_stage:          string | null
  customer_type:       string | null
  mrr_value:           number | null
  one_time_revenue:    number | null
  name:                string | null
  company_name:        string | null
  assigned_to:         string | null
  lead_date?:          string | null
  successful_meetings?: boolean | null
}

function isClosed(l: LeadLite) {
  return l.lead_stage === 'Closed Won' || (l.lead_status === 'SQL' && ((l.mrr_value ?? 0) > 0 || (l.one_time_revenue ?? 0) > 0))
}

const TYPE_COLOR: Record<string, string> = {
  'NBEC': 'bg-amber-50 text-amber-700 ring-amber-200',
  'NBNC': 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
}

interface DrillDown { source: string; filter: 'MQL' | 'SQL' | 'NBEC' | 'NBNC' | 'ALL' }

export default function SourceFunnelChart({ leads }: { leads: LeadLite[] }) {
  const [drill, setDrill] = useState<DrillDown | null>(null)

  const rows = useMemo(() => {
    const map: Record<string, { total: number; mql: number; sql: number; nbec: number; nbnc: number; other: number; meetings: number }> = {}
    for (const l of leads) {
      const src = l.lead_source?.trim() || 'Unspecified'
      if (!map[src]) map[src] = { total: 0, mql: 0, sql: 0, nbec: 0, nbnc: 0, other: 0, meetings: 0 }
      map[src].total++
      if (l.lead_status === 'MQL') map[src].mql++
      if (l.lead_status === 'SQL') map[src].sql++
      if (l.successful_meetings) map[src].meetings++
      if (isClosed(l)) {
        const ct = (l.customer_type ?? '').trim().toUpperCase()
        if (ct === 'NBEC') map[src].nbec++
        else if (ct === 'NBNC') map[src].nbnc++
        else map[src].other++
      }
    }
    return Object.entries(map)
      .map(([source, c]) => ({ source, category: classifyLeadSource(source), ...c, customers: c.nbec + c.nbnc + c.other }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  const totals = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, mql: acc.mql + r.mql, sql: acc.sql + r.sql, customers: acc.customers + r.customers, nbec: acc.nbec + r.nbec, nbnc: acc.nbnc + r.nbnc, meetings: acc.meetings + r.meetings }),
    { total: 0, mql: 0, sql: 0, customers: 0, nbec: 0, nbnc: 0, meetings: 0 },
  )

  // Modal leads
  const modalLeads = useMemo(() => {
    if (!drill) return []
    return leads.filter(l => {
      if ((l.lead_source?.trim() || 'Unspecified') !== drill.source) return false
      if (drill.filter === 'MQL') return l.lead_status === 'MQL'
      if (drill.filter === 'SQL') return l.lead_status === 'SQL'
      if (!isClosed(l)) return false
      if (drill.filter === 'ALL') return true
      return (l.customer_type ?? '').trim().toUpperCase() === drill.filter
    })
  }, [leads, drill])

  const isStatusDrill = drill?.filter === 'MQL' || drill?.filter === 'SQL'
  const modalTitle = drill
    ? drill.filter === 'ALL' ? `${drill.source} — All Closed`
    : drill.filter === 'MQL' ? `${drill.source} — MQL Leads`
    : drill.filter === 'SQL' ? `${drill.source} — SQL Leads`
    : `${drill.source} — ${drill.filter}`
    : ''

  if (rows.length === 0) return null

  return (
    <>
      <Panel
        icon={GitMerge}
        title="Funnel by Lead Source"
        accent="indigo"
        noPad
        caption="Total → MQL / SQL → Closed (SQL + revenue) · NBEC = existing customer · NBNC = new customer · click cells for details"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
              <tr>
                <th className="px-4 py-2.5 text-left  font-bold text-slate-400 uppercase tracking-wider">Lead Source</th>
                <th className="px-4 py-2.5 text-right font-bold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-4 py-2.5 text-right font-bold text-indigo-400 uppercase tracking-wider">MQL</th>
                <th className="px-4 py-2.5 text-right font-bold text-emerald-500 uppercase tracking-wider">SQL</th>
                <th className="px-4 py-2.5 text-right font-bold text-amber-500 uppercase tracking-wider">NBEC</th>
                <th className="px-4 py-2.5 text-right font-bold text-fuchsia-500 uppercase tracking-wider">NBNC</th>
                <th className="px-4 py-2.5 text-right font-bold text-sky-500 uppercase tracking-wider">Meetings</th>
                <th className="px-4 py-2.5 text-right font-bold text-fuchsia-600 uppercase tracking-wider">Closed</th>
                <th className="px-4 py-2.5 text-right font-bold text-fuchsia-600 uppercase tracking-wider pr-5">Conv %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => {
                const mqlPct  = r.total > 0 ? Math.round((r.mql / r.total) * 100) : 0
                const sqlPct  = r.total > 0 ? Math.round((r.sql / r.total) * 100) : 0
                const custPct = r.total > 0 ? (r.customers / r.total) * 100 : 0
                const style   = CATEGORY_STYLES[r.category] ?? CATEGORY_STYLES['Digital MQL']

                const clickable = 'cursor-pointer hover:opacity-75 transition-opacity'

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
                      {r.mql > 0
                        ? <span onClick={() => setDrill({ source: r.source, filter: 'MQL' })} className={`font-semibold text-indigo-700 ${clickable}`}>
                            {r.mql} <span className="text-slate-400">({mqlPct}%)</span>
                          </span>
                        : <span className="font-semibold text-indigo-700">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.sql > 0
                        ? <span onClick={() => setDrill({ source: r.source, filter: 'SQL' })} className={`font-semibold text-emerald-700 ${clickable}`}>
                            {r.sql} <span className="text-slate-400">({sqlPct}%)</span>
                          </span>
                        : <span className="font-semibold text-emerald-700">0</span>}
                    </td>
                    {/* NBEC — clickable */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.nbec > 0
                        ? <span onClick={() => setDrill({ source: r.source, filter: 'NBEC' })} className={`font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ${clickable}`}>{r.nbec}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    {/* NBNC — clickable */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.nbnc > 0
                        ? <span onClick={() => setDrill({ source: r.source, filter: 'NBNC' })} className={`font-bold text-fuchsia-700 bg-fuchsia-50 px-1.5 py-0.5 rounded ${clickable}`}>{r.nbnc}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Meetings */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.meetings > 0
                        ? <span className="font-bold text-sky-700">{r.meetings}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Closed total — clickable */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.customers > 0
                        ? <span onClick={() => setDrill({ source: r.source, filter: 'ALL' })} className={`font-bold text-fuchsia-700 ${clickable}`}>{r.customers}</span>
                        : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="px-4 py-3 pr-5 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500" style={{ width: `${Math.min(custPct, 100)}%` }} />
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
                <td className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total · {rows.length} source{rows.length === 1 ? '' : 's'}</td>
                <td className="px-4 py-2.5 text-right font-extrabold text-slate-800 tabular-nums">{totals.total}</td>
                <td className="px-4 py-2.5 text-right font-bold text-indigo-700 tabular-nums">{totals.mql}</td>
                <td className="px-4 py-2.5 text-right font-bold text-emerald-700 tabular-nums">{totals.sql}</td>
                <td className="px-4 py-2.5 text-right font-bold text-amber-600 tabular-nums">{totals.nbec}</td>
                <td className="px-4 py-2.5 text-right font-bold text-fuchsia-700 tabular-nums">{totals.nbnc}</td>
                <td className="px-4 py-2.5 text-right font-bold text-sky-700 tabular-nums">{totals.meetings}</td>
                <td className="px-4 py-2.5 text-right font-bold text-fuchsia-700 tabular-nums">{totals.customers}</td>
                <td className="px-4 py-2.5 pr-5 text-right font-bold text-fuchsia-700 tabular-nums">
                  {totals.total > 0 ? ((totals.customers / totals.total) * 100).toFixed(1) : '0.0'}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      {/* ── Drill-down modal ── */}
      {drill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrill(null)} aria-hidden />
          <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 rounded-t-2xl">
              <div>
                <p className="text-sm font-extrabold text-white">{modalTitle}</p>
                <p className="text-[11px] text-white/70 mt-0.5">{modalLeads.length} lead{modalLeads.length === 1 ? '' : 's'}{isStatusDrill ? '' : ' · SQL + revenue'}</p>
              </div>
              <button onClick={() => setDrill(null)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              {modalLeads.length === 0
                ? <p className="text-sm text-slate-400 text-center py-16">No leads found.</p>
                : isStatusDrill ? (
                  /* ── MQL / SQL leads table ── */
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['#', 'Name', 'Company', 'Stage', 'Date', 'Assigned'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {modalLeads.map((l, i) => (
                        <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-4 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 flex items-center justify-center shrink-0">
                                <User size={10} className="text-white" />
                              </div>
                              {l.name || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Briefcase size={11} className="text-slate-300 shrink-0" />
                              {l.company_name || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{l.lead_stage || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 tabular-nums whitespace-nowrap">{l.lead_date || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{l.assigned_to || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                      <tr>
                        <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider" colSpan={6}>
                          {modalLeads.length} lead{modalLeads.length === 1 ? '' : 's'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  /* ── Closed deals table ── */
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['#', 'Name', 'Company', 'Type', 'MRR', 'One-time', 'ACV', 'Assigned'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {modalLeads.map((l, i) => {
                        const ct  = (l.customer_type ?? '').trim().toUpperCase()
                        const mrr = Number(l.mrr_value) || 0
                        const ot  = Number(l.one_time_revenue) || 0
                        const acv = annualContractValue(mrr, ot)
                        return (
                          <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-4 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 flex items-center justify-center shrink-0">
                                  <User size={10} className="text-white" />
                                </div>
                                {l.name || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Briefcase size={11} className="text-slate-300 shrink-0" />
                                {l.company_name || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {ct
                                ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${TYPE_COLOR[ct] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{ct}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-700 tabular-nums">{mrr > 0 ? formatUSD(mrr) : '—'}</td>
                            <td className="px-4 py-3 text-slate-700 tabular-nums">{ot  > 0 ? formatUSD(ot)  : '—'}</td>
                            <td className="px-4 py-3 font-semibold text-indigo-700 tabular-nums">{acv > 0 ? formatUSD(acv) : '—'}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{l.assigned_to || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                      <tr>
                        <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider" colSpan={4}>
                          Total · {modalLeads.length} deal{modalLeads.length === 1 ? '' : 's'}
                        </td>
                        <td className="px-4 py-2.5 font-extrabold text-slate-700 tabular-nums">
                          {formatUSD(modalLeads.reduce((s, l) => s + (Number(l.mrr_value) || 0), 0))}
                        </td>
                        <td className="px-4 py-2.5 font-extrabold text-slate-700 tabular-nums">
                          {formatUSD(modalLeads.reduce((s, l) => s + (Number(l.one_time_revenue) || 0), 0))}
                        </td>
                        <td className="px-4 py-2.5 font-extrabold text-indigo-700 tabular-nums">
                          {formatUSD(modalLeads.reduce((s, l) => s + annualContractValue(Number(l.mrr_value) || 0, Number(l.one_time_revenue) || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
