import type { Settings, Lead } from '@/types'
import { deriveTargets } from '@/lib/calculations'
import {
  classifyLeadSource, hoursToSeats, formatSeats,
  FISCAL_MONTHS, fiscalYearStart, fiscalYearLabel,
} from '@/lib/leads'
import { Target } from 'lucide-react'

type MetricKey = 'mql' | 'sql' | 'direct' | 'event' | 'seats'

const METRICS: { key: MetricKey; label: string; annual: (t: ReturnType<typeof deriveTargets>, s: Settings) => number }[] = [
  { key: 'mql',    label: 'MQL',        annual: t => t.digital_mqls },
  { key: 'sql',    label: 'SQL',        annual: t => t.annual_sqls },
  { key: 'direct', label: 'Direct SQL', annual: t => t.digital_sqls },
  { key: 'event',  label: 'Event SQL',  annual: t => t.event_sqls },
  { key: 'seats',  label: 'Seats',      annual: (_t, s) => s.annual_seats_target },
]

// green >=100%, amber 60-99%, red <60%, grey future/no target
function tone(actual: number, target: number, future: boolean) {
  if (future) return 'text-slate-300'
  if (target <= 0) return 'text-slate-400'
  const p = actual / target
  if (p >= 1) return 'text-emerald-600'
  if (p >= 0.6) return 'text-amber-600'
  return 'text-rose-600'
}
function pct(actual: number, target: number) {
  if (target <= 0) return '—'
  return `${Math.round((actual / target) * 100)}%`
}

export default function MonthlyGoalTracker({ leads, settings }: { leads: Lead[]; settings: Settings }) {
  const t = deriveTargets(settings)
  const today = new Date()
  const fyStart = fiscalYearStart(today)
  const todayYm = today.toISOString().slice(0, 7)

  const monthlyTarget: Record<MetricKey, number> = {
    mql: t.digital_mqls / 12,
    sql: t.annual_sqls / 12,
    direct: t.digital_sqls / 12,
    event: t.event_sqls / 12,
    seats: settings.annual_seats_target / 12,
  }
  const annualTarget: Record<MetricKey, number> = {
    mql: t.digital_mqls, sql: t.annual_sqls, direct: t.digital_sqls, event: t.event_sqls, seats: settings.annual_seats_target,
  }

  // Actuals per fiscal month
  const rows = FISCAL_MONTHS.map(fm => {
    const year = ['01', '02', '03'].includes(fm.mm) ? fyStart + 1 : fyStart
    const ym = `${year}-${fm.mm}`
    const monthLeads = leads.filter(l => (l.lead_date ?? '').startsWith(ym))
    const cat = (l: Lead) => classifyLeadSource(l.lead_source)
    const direct = monthLeads.filter(l => cat(l) === 'Direct SQL').length
    const event = monthLeads.filter(l => cat(l) === 'Event SQL').length
    const mql = monthLeads.filter(l => cat(l) === 'Digital MQL').length
    const seats = leads
      .filter(l => l.lead_stage === 'Closed Won' && (l.closed_date ?? '').startsWith(ym))
      .reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
    const actual: Record<MetricKey, number> = { mql, sql: direct + event, direct, event, seats }
    return { ym, name: fm.name, future: ym > todayYm, actual }
  })

  const elapsed = rows.filter(r => r.ym <= todayYm).length
  const ytd = (k: MetricKey) => rows.filter(r => r.ym <= todayYm).reduce((s, r) => s + r.actual[k], 0)
  const targetToDate = (k: MetricKey) => monthlyTarget[k] * elapsed

  const num = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace(/\.?0+$/, ''))

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-indigo-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Goal vs Achievement — {fiscalYearLabel(fyStart)}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Annual goal: <b>{settings.annual_seats_target} seats</b> · <b>{t.digital_mqls} MQL</b> · <b>{t.annual_sqls} SQL</b> ({t.digital_sqls} Direct + {t.event_sqls} Event) · month-by-month achievement
      </p>

      {/* YTD summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {METRICS.map(m => {
          const a = ytd(m.key), td = targetToDate(m.key)
          const p = td > 0 ? a / td : 0
          const badge = p >= 1 ? 'bg-emerald-50 text-emerald-700' : p >= 0.6 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          return (
            <div key={m.key} className="rounded-xl ring-1 ring-slate-100 px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
              <p className="text-xl font-extrabold text-slate-800 tabular-nums mt-0.5">
                {m.key === 'seats' ? formatSeats(a) : a}
                <span className="text-xs text-slate-400 font-bold"> / {num(td)}</span>
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${badge}`}>{pct(a, td)} to date</span>
                <span className="text-[10px] text-slate-400">of {annualTarget[m.key]}/yr</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Monthly table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Month</th>
              {METRICS.map(m => (
                <th key={m.key} className="text-right font-bold uppercase tracking-wider py-2 px-3">{m.label}<span className="block text-[9px] font-medium text-slate-300 normal-case">act / tgt</span></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => (
              <tr key={r.ym} className={`${r.ym === todayYm ? 'bg-indigo-50/40' : ''} hover:bg-slate-50/60`}>
                <td className="py-2.5 pl-1 font-semibold text-slate-700">{r.name}{r.ym === todayYm ? ' •' : ''}</td>
                {METRICS.map(m => {
                  const a = r.actual[m.key], tg = monthlyTarget[m.key]
                  return (
                    <td key={m.key} className="py-2.5 px-3 text-right tabular-nums">
                      <span className={`font-bold ${tone(a, tg, r.future)}`}>{r.future ? '—' : (m.key === 'seats' ? formatSeats(a) : a)}</span>
                      <span className="text-slate-300"> / {num(tg)}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-extrabold">
              <td className="py-2.5 pl-1 text-slate-800">YTD</td>
              {METRICS.map(m => {
                const a = ytd(m.key), td = targetToDate(m.key)
                return (
                  <td key={m.key} className="py-2.5 px-3 text-right tabular-nums">
                    <span className={tone(a, td, false)}>{m.key === 'seats' ? formatSeats(a) : a}</span>
                    <span className="text-slate-300"> / {num(td)}</span>
                  </td>
                )
              })}
            </tr>
            <tr className="text-slate-400">
              <td className="py-1.5 pl-1 text-[10px] uppercase tracking-wider">Annual goal</td>
              {METRICS.map(m => <td key={m.key} className="py-1.5 px-3 text-right tabular-nums text-slate-500 font-bold">{annualTarget[m.key]}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
