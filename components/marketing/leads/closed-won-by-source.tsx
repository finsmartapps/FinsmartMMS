'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { Panel } from '@/components/marketing/ui/panel'
import { Trophy, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  classifyLeadSource, formatUSD, annualContractValue, hoursToSeats, formatSeats,
  CATEGORY_STYLES,
} from '@/lib/leads'
import { PALETTE } from '@/components/marketing/charts/dashboard-charts'
import type { Lead } from '@/types'

const MONTHS = 12

function fmtMRR(v: number) {
  if (!v) return ''
  if (v >= 1000) return `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `$${v}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface MonthMeta { key: string; label: string; from: string; to: string }

function SumCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 text-center">
      <p className="text-base font-extrabold text-slate-800 tabular-nums">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

function SourceModal({ month, leads, onClose }: {
  month: MonthMeta
  leads: Lead[]
  onClose: () => void
}) {
  const totalSeats = leads.reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
  const totalMrr   = leads.reduce((s, l) => s + (l.mrr_value ?? 0), 0)
  const totalOne   = leads.reduce((s, l) => s + (l.one_time_revenue ?? 0), 0)
  const totalAcv   = annualContractValue(totalMrr, totalOne)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-white font-extrabold text-lg">Closed Won — {month.label}</h3>
            <p className="text-emerald-100 text-xs mt-0.5">
              {leads.length} deal{leads.length !== 1 ? 's' : ''} closed this month
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
          <SumCell label="Deals"  value={String(leads.length)} />
          <SumCell label="Seats"  value={formatSeats(totalSeats)} />
          <SumCell label="MRR"    value={formatUSD(totalMrr)} />
          <SumCell label="ACV"    value={formatUSD(totalAcv)} />
        </div>

        {/* Table or empty */}
        {leads.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm py-12">
            No Closed Won deals in {month.label}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Name', 'Company', 'Lead Source', 'Closed Date', 'Seats', 'MRR', 'One-time', 'ACV', 'Assigned'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map(l => {
                  const seats = hoursToSeats(l.closed_hours ?? 0)
                  const mrr   = l.mrr_value ?? 0
                  const one   = l.one_time_revenue ?? 0
                  const acv   = annualContractValue(mrr, one)
                  const cat   = classifyLeadSource(l.lead_source)
                  const style = CATEGORY_STYLES[cat]
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{l.name || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.company_name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ring-1 ${style.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {l.lead_source || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap tabular-nums">{fmtDate(l.closed_date)}</td>
                      <td className="px-4 py-2.5 text-slate-700 tabular-nums">{formatSeats(seats)}</td>
                      <td className="px-4 py-2.5 text-slate-700 tabular-nums">{mrr ? formatUSD(mrr) : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-700 tabular-nums">{one ? formatUSD(one) : '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-700 tabular-nums">{acv ? formatUSD(acv) : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{l.assigned_to || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Totals</td>
                  <td className="px-4 py-2.5 font-bold text-slate-800 tabular-nums">{formatSeats(totalSeats)}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-800 tabular-nums">{formatUSD(totalMrr)}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-800 tabular-nums">{formatUSD(totalOne)}</td>
                  <td className="px-4 py-2.5 font-bold text-emerald-700 tabular-nums">{formatUSD(totalAcv)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClosedWonBySource({ won }: { won: Lead[] }) {
  const [offset, setOffset] = useState(0)
  const [activeMonth, setActiveMonth] = useState<MonthMeta | null>(null)

  // Stable source list + color map derived from the full dataset (not offset-dependent)
  const { sources, sourceColors } = useMemo(() => {
    const counts = won.reduce<Record<string, number>>((acc, l) => {
      const s = l.lead_source || 'Unspecified'
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    }, {})
    const sources = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s]) => s)
    const sourceColors: Record<string, string> = {}
    sources.forEach((s, i) => { sourceColors[s] = PALETTE[i % PALETTE.length] })
    return { sources, sourceColors }
  }, [won])

  const { data, months } = useMemo(() => {
    const today = new Date()
    // If any deal has a future closed_date, extend the right edge to cover it
    const latestYm = won.reduce((max, l) => {
      const ym = (l.closed_date ?? '').slice(0, 7)
      return ym > max ? ym : max
    }, '')
    const latestDate = latestYm ? new Date(latestYm + '-01') : today
    const base = latestDate > today ? latestDate : today
    const anchor = new Date(base.getFullYear(), base.getMonth() - offset * MONTHS, 1)

    const months: MonthMeta[] = Array.from({ length: MONTHS }, (_, i) => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - (MONTHS - 1 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      return {
        key,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        from: `${key}-01`,
        to:   `${key}-${String(lastDay).padStart(2, '0')}`,
      }
    })

    const data = months.map(m => {
      const monthLeads = won.filter(l => (l.closed_date ?? '') >= m.from && (l.closed_date ?? '') <= m.to)
      const point: Record<string, string | number> = { name: m.label }
      for (const s of sources) {
        point[s] = monthLeads.filter(l => (l.lead_source || 'Unspecified') === s).length
      }
      // _mrr = total MRR for label; _zero = 0-height bar that anchors the label at top of stack
      point['_mrr']  = monthLeads.reduce((s, l) => s + (l.mrr_value ?? 0), 0)
      point['_zero'] = 0
      return point
    })

    return { data, months }
  }, [won, offset, sources])

  const visibleTotal = useMemo(
    () => won.filter(l => months.some(m => (l.closed_date ?? '') >= m.from && (l.closed_date ?? '') <= m.to)).length,
    [won, months]
  )

  const modalLeads = useMemo(() => {
    if (!activeMonth) return []
    return won
      .filter(l => (l.closed_date ?? '') >= activeMonth.from && (l.closed_date ?? '') <= activeMonth.to)
      .sort((a, b) => (b.closed_date ?? '').localeCompare(a.closed_date ?? ''))
  }, [won, activeMonth])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (state: any) => {
    if (!state?.activeLabel) return
    const m = months.find(m => m.label === state.activeLabel)
    if (m) setActiveMonth(m)
  }

  const rangeLabel = months.length > 0
    ? `${months[0].label} – ${months[months.length - 1].label}`
    : ''

  return (
    <>
      <Panel
        icon={Trophy}
        title="Closed Won by Source"
        accent="emerald"
        caption={`${rangeLabel} · ${visibleTotal} deals · click any bar for details`}
      >
        <div style={{ height: 250 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 24, right: 8, left: -16, bottom: 4 }}
              barCategoryGap="30%"
              onClick={handleBarClick}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid vertical={false} stroke="#eef0f5" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  const items = (payload as any[]).filter(p => !String(p.dataKey).startsWith('_') && (p.value as number) > 0)
                  const mrr = (payload[0]?.payload?._mrr as number) ?? 0
                  if (!items.length) return null
                  return (
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-xs min-w-[130px]">
                      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
                      {items.map((p: any) => (
                        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.fill }} />
                          <span className="text-slate-600 flex-1">{p.name}</span>
                          <strong className="text-slate-800">{p.value}</strong>
                        </div>
                      ))}
                      {mrr > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex justify-between">
                          <span className="text-slate-500">MRR</span>
                          <strong className="text-emerald-700">{formatUSD(mrr)}</strong>
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              {sources.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="a"
                  fill={sourceColors[s]}
                  radius={i === sources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={40}
                />
              ))}
              {/* Zero-height bar anchored at top of stack — carries the MRR label */}
              <Bar dataKey="_zero" stackId="a" fill="none" stroke="none" maxBarSize={40} isAnimationActive={false} legendType="none">
                <LabelList
                  dataKey="_mrr"
                  position="top"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={(props: any) => {
                    const mrr = props.value as number
                    if (!mrr) return null
                    const cx = (props.x ?? 0) + (props.width ?? 0) / 2
                    const cy = (props.y ?? 0) - 5
                    return (
                      <text x={cx} y={cy} textAnchor="middle" fontSize={9} fill="#059669" fontWeight={700}>
                        {fmtMRR(mrr)}
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + navigation */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex flex-wrap items-center gap-3">
            {sources.map(s => (
              <span key={s} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: sourceColors[s] }} />
                {s}
              </span>
            ))}
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

      {activeMonth && (
        <SourceModal
          month={activeMonth}
          leads={modalLeads}
          onClose={() => setActiveMonth(null)}
        />
      )}
    </>
  )
}
