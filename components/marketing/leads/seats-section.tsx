'use client'

import { useState, useMemo } from 'react'
import { VBarChart, HBarChart, RadialGauge } from '@/components/marketing/charts/dashboard-charts'
import { Panel } from '@/components/marketing/ui/panel'
import { hoursToSeats, annualContractValue, formatSeats, formatUSD, classifyLeadSource } from '@/lib/leads'
import type { Lead } from '@/types'
import { Armchair, Repeat, DollarSign, Sparkles, Target, Layers, Users, ArrowUpRight, X, ExternalLink } from 'lucide-react'

type FilterMode = 'week' | 'month' | 'pick-month' | 'custom' | 'alltime'

const PILLS: { mode: FilterMode; label: string }[] = [
  { mode: 'week',       label: 'This Week'    },
  { mode: 'month',      label: 'This Month'   },
  { mode: 'pick-month', label: 'Select Month' },
  { mode: 'custom',     label: 'Date Range'   },
  { mode: 'alltime',    label: 'All Time'     },
]

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getRange(mode: FilterMode, pickMonth: string, from: string, to: string) {
  const today = new Date()
  if (mode === 'week') {
    const day = today.getDay()
    const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: isoDate(mon), to: isoDate(sun) }
  }
  if (mode === 'month') {
    const y = today.getFullYear(), m = today.getMonth()
    return {
      from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
    }
  }
  if (mode === 'pick-month' && pickMonth) {
    const [y, m] = pickMonth.split('-').map(Number)
    return { from: `${pickMonth}-01`, to: `${pickMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }
  }
  if (mode === 'custom') return { from: from || '2000-01-01', to: to || '2099-12-31' }
  return { from: '2000-01-01', to: '2099-12-31' }
}

function defaultPickMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props { won: Lead[]; seatsTarget: number }

export default function SeatsSection({ won, seatsTarget }: Props) {
  const [mode, setMode] = useState<FilterMode>('month')
  const [pickMonth, setPickMonth] = useState(defaultPickMonth)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showModal, setShowModal] = useState(false)

  const range = useMemo(() => getRange(mode, pickMonth, customFrom, customTo), [mode, pickMonth, customFrom, customTo])

  const filtered = useMemo(() =>
    won.filter(l => { const d = l.closed_date ?? ''; return d >= range.from && d <= range.to }),
    [won, range])

  const sumH = (k: 'closed_hours' | 'mrr_value' | 'one_time_revenue') =>
    filtered.reduce((s, l) => s + (Number(l[k]) || 0), 0)

  const seats    = hoursToSeats(sumH('closed_hours'))
  const mrr      = sumH('mrr_value')
  const oneTime  = sumH('one_time_revenue')
  const acv      = annualContractValue(mrr, oneTime)
  const count    = filtered.length
  const avg      = count ? seats / count : 0
  const monthly  = seatsTarget / 12

  // Proportional target for the active filter window
  const effectiveTarget = useMemo(() => {
    if (mode === 'week') return seatsTarget / 52
    if (mode === 'month' || mode === 'pick-month') return seatsTarget / 12
    if (mode === 'custom' && customFrom && customTo) {
      const days = Math.max(1,
        (new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000 + 1)
      return (seatsTarget / 365) * days
    }
    return seatsTarget
  }, [mode, customFrom, customTo, seatsTarget])

  const targetLabel = mode === 'week'       ? 'Weekly Target'
    : (mode === 'month' || mode === 'pick-month') ? 'Monthly Target'
    : mode === 'custom' ? 'Period Target'
    : 'Annual Target'

  const monthBars = useMemo(() => {
    const seen = new Set<string>()
    filtered.forEach(l => { if (l.closed_date) seen.add((l.closed_date as string).slice(0, 7)) })
    return Array.from(seen).sort().map(ym => {
      const [y, m] = ym.split('-')
      const name = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const hours = filtered
        .filter(l => (l.closed_date ?? '').startsWith(ym))
        .reduce((s, l) => s + (Number(l.closed_hours) || 0), 0)
      return { name, value: Number(hoursToSeats(hours).toFixed(2)) }
    })
  }, [filtered])

  const byOwner = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(l => {
      const who = (l.assigned_to?.trim()) || 'Unassigned'
      map[who] = (map[who] ?? 0) + (Number(l.closed_hours) || 0)
    })
    return Object.entries(map)
      .map(([name, h]) => ({ name, value: Number(hoursToSeats(h).toFixed(2)) }))
      .filter(d => d.value > 0).sort((a, b) => b.value - a.value)
  }, [filtered])

  const byCategory = useMemo(() =>
    (['Digital MQL', 'Direct SQL', 'Event SQL'] as const).map(cat => ({
      name: cat,
      value: Number(hoursToSeats(
        filtered.filter(l => classifyLeadSource(l.lead_source) === cat)
          .reduce((s, l) => s + (Number(l.closed_hours) || 0), 0)
      ).toFixed(2)),
    })).filter(d => d.value > 0),
    [filtered])

  const rangeLabel = mode === 'pick-month' && pickMonth
    ? new Date(Number(pickMonth.split('-')[0]), Number(pickMonth.split('-')[1]) - 1, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : mode === 'custom'
    ? `${customFrom || '…'} → ${customTo || '…'}`
    : PILLS.find(p => p.mode === mode)!.label

  // sorted by closed_date desc for modal table
  const sortedForModal = useMemo(() =>
    [...filtered].sort((a, b) => (b.closed_date ?? '').localeCompare(a.closed_date ?? '')),
    [filtered])

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-white ring-1 ring-slate-200 rounded-xl p-0.5 gap-0.5 flex-wrap">
          {PILLS.map(({ mode: m, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                mode === m ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'pick-month' && (
          <input
            type="month"
            value={pickMonth}
            onChange={e => setPickMonth(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
        )}

        {mode === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
            <span className="text-xs text-slate-400 font-medium">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Armchair}   gradient="from-emerald-500 via-teal-600 to-cyan-700"    glow="glow-emerald"
          label="Seats Closed"   value={formatSeats(seats)}
          foot={`${count} deal${count === 1 ? '' : 's'} · avg ${formatSeats(avg)}/deal`}
          onClick={() => setShowModal(true)} />
        <StatCard icon={Repeat}     gradient="from-indigo-500 via-indigo-600 to-violet-700" glow="glow-indigo"
          label="MRR Closed"     value={formatUSD(mrr)}       foot="monthly recurring"
          onClick={() => setShowModal(true)} />
        <StatCard icon={DollarSign} gradient="from-violet-500 via-purple-600 to-fuchsia-700" glow="glow-violet"
          label="One-time"       value={formatUSD(oneTime)}   foot="one-time revenue"
          onClick={() => setShowModal(true)} />
        <StatCard icon={Sparkles}   gradient="from-amber-500 via-orange-600 to-rose-600"    glow="glow-amber"
          label="ACV Closed"     value={formatUSD(acv)}       foot="MRR × 12 + one-time"
          onClick={() => setShowModal(true)} />
      </div>

      {/* ── Gauge + bar chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel icon={Target} title={`Seats vs ${targetLabel} — ${rangeLabel}`} accent="emerald"
          caption={mode === 'alltime'
            ? `Goal ${seatsTarget} seats/yr · ${monthly.toFixed(1)}/mo pace`
            : `Goal ${formatSeats(effectiveTarget)} seats · annual ${seatsTarget}/yr`}>
          <div className="flex flex-col items-center pt-1">
            <RadialGauge value={seats} max={effectiveTarget} label="of target" color="#10b981" />
            <p className="text-center text-2xl font-extrabold text-slate-800 tabular-nums mt-2">
              {formatSeats(seats)}<span className="text-base text-slate-400 font-bold"> / {formatSeats(effectiveTarget)}</span>
            </p>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">seats closed</p>
          </div>
        </Panel>

        <Panel icon={Armchair} title="Seats by Month" accent="indigo" className="lg:col-span-2"
          caption={monthBars.length === 0 ? 'No closed deals in this period' : `${rangeLabel} · dashed = monthly pace (${monthly.toFixed(1)})`}>
          <div className="pt-1">
            {monthBars.length > 0
              ? <VBarChart data={monthBars} unit=" seats" target={Number(monthly.toFixed(2))} targetLabel={`pace ${monthly.toFixed(1)}`} />
              : <p className="text-xs text-slate-400 py-10 text-center">No Closed Won deals with seat data in this period</p>}
          </div>
        </Panel>
      </div>

      {/* ── By owner / by category ── */}
      {(byCategory.length > 0 || byOwner.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel icon={Layers} title="Seats by Funnel Category" accent="violet">
            <div className="pt-2">
              {byCategory.length > 0
                ? <HBarChart data={byCategory} unit=" seats" />
                : <p className="text-xs text-slate-400 py-8 text-center">No data</p>}
            </div>
          </Panel>
          <Panel icon={Users} title="Seats by Owner" accent="emerald">
            <div className="pt-2">
              {byOwner.length > 0
                ? <HBarChart data={byOwner} unit=" seats" />
                : <p className="text-xs text-slate-400 py-8 text-center">No data</p>}
            </div>
          </Panel>
        </div>
      )}

      {/* ── Deal details modal ── */}
      {showModal && (
        <DealsModal
          deals={sortedForModal}
          rangeLabel={rangeLabel}
          totals={{ seats, mrr, oneTime, acv }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

/* ── Stat card ── */

function StatCard({ icon: Icon, label, value, foot, gradient, glow, onClick }: {
  icon: React.ElementType; label: string; value: string; foot: string
  gradient: string; glow: string; onClick?: () => void
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 hover-lift ${glow}${onClick ? ' cursor-pointer group' : ''}`}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" aria-hidden />
      {onClick && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="h-3.5 w-3.5 text-white/70" />
        </div>
      )}
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25 mb-3">
          <Icon className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />
        </div>
        <p className="text-3xl font-extrabold text-white leading-none tabular-nums">{value}</p>
        <p className="text-[11px] font-bold text-white/75 uppercase tracking-widest mt-2">{label}</p>
        <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1 leading-tight">
          <ArrowUpRight className="h-3 w-3 shrink-0" /> {foot}
        </p>
      </div>
    </div>
  )
}

/* ── Deal details modal ── */

function DealsModal({ deals, rangeLabel, totals, onClose }: {
  deals: Lead[]
  rangeLabel: string
  totals: { seats: number; mrr: number; oneTime: number; acv: number }
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25">
              <Armchair className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Closed Won Deals</p>
              <p className="text-[11px] text-white/70">{rangeLabel} · {deals.length} deal{deals.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* summary strip */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
          {[
            { label: 'Total Seats', value: formatSeats(totals.seats) },
            { label: 'MRR',         value: formatUSD(totals.mrr)     },
            { label: 'One-time',    value: formatUSD(totals.oneTime) },
            { label: 'ACV',         value: formatUSD(totals.acv)     },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-3 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
              <p className="text-base font-extrabold text-slate-800 tabular-nums mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* table */}
        <div className="overflow-auto flex-1">
          {deals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">No Closed Won deals in this period.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  {['#', 'Name', 'Company', 'Closed Date', 'Seats', 'MRR', 'One-time', 'ACV', 'Assigned', 'Service'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deals.map((d, i) => {
                  const s   = hoursToSeats(Number(d.closed_hours) || 0)
                  const m   = Number(d.mrr_value) || 0
                  const ot  = Number(d.one_time_revenue) || 0
                  const a   = annualContractValue(m, ot)
                  return (
                    <tr key={d.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{d.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{d.company_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">{fmtDate(d.closed_date)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700 tabular-nums">{s > 0 ? formatSeats(s) : '—'}</td>
                      <td className="px-4 py-3 text-slate-700 tabular-nums">{m > 0 ? formatUSD(m) : '—'}</td>
                      <td className="px-4 py-3 text-slate-700 tabular-nums">{ot > 0 ? formatUSD(ot) : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-700 tabular-nums">{a > 0 ? formatUSD(a) : '—'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{d.assigned_to || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap max-w-[150px] truncate">{d.service_required || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              {/* totals row */}
              <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-2.5" colSpan={4}>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total · {deals.length} deals</span>
                  </td>
                  <td className="px-4 py-2.5 font-extrabold text-emerald-700 tabular-nums">{formatSeats(totals.seats)}</td>
                  <td className="px-4 py-2.5 font-extrabold text-slate-700 tabular-nums">{formatUSD(totals.mrr)}</td>
                  <td className="px-4 py-2.5 font-extrabold text-slate-700 tabular-nums">{formatUSD(totals.oneTime)}</td>
                  <td className="px-4 py-2.5 font-extrabold text-indigo-700 tabular-nums">{formatUSD(totals.acv)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
