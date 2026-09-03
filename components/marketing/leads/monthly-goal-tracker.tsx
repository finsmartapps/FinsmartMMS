import type { Settings, Lead, PlanEvent } from '@/types'
import { deriveTargets } from '@/lib/calculations'
import {
  classifyLeadSource, hoursToSeats, formatSeats,
  FISCAL_MONTHS, FISCAL_QUARTERS, fiscalYearStart, fiscalYearLabel,
} from '@/lib/leads'
import { Target } from 'lucide-react'

type MetricKey = 'mql' | 'sql' | 'direct' | 'event' | 'total' | 'seats'

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'mql',    label: 'MQL'        },
  { key: 'sql',    label: 'SQL'        },
  { key: 'direct', label: 'Direct SQL' },
  { key: 'event',  label: 'Event SQL'  },
  { key: 'total',  label: 'Total'      },
  { key: 'seats',  label: 'Seats'      },
]

function tone(actual: number, target: number, future: boolean) {
  if (future) return 'text-slate-300'
  if (target <= 0) return 'text-slate-400'
  const p = actual / target
  if (p >= 1) return 'text-emerald-600'
  if (p >= 0.6) return 'text-amber-600'
  return 'text-rose-600'
}
function pct(actual: number, target: number) {
  return target <= 0 ? '—' : `${Math.round((actual / target) * 100)}%`
}
const num = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(/\.0$/, ''))

// months (mm) a plan-event quarter covers; handles "Q3–Q4" / "Q3-Q4"
function quarterMonths(quarter: string): string[] {
  const parts = String(quarter).split(/[–-]/).map(p => p.trim())
  const months: string[] = []
  for (const p of parts) {
    const q = FISCAL_QUARTERS.find(fq => fq.label === p)
    if (q) months.push(...q.months)
  }
  return months
}

export default function MonthlyGoalTracker({ leads, settings, events }: { leads: Lead[]; settings: Settings; events: PlanEvent[] }) {
  const t = deriveTargets(settings)
  const today = new Date()
  const fyStart = fiscalYearStart(today)
  const todayYm = today.toISOString().slice(0, 7)

  // Flat monthly targets for steady channels
  const MQL_M = t.digital_mqls / 12
  const DIR_M = t.digital_sqls / 12
  const SEATS_M = settings.annual_seats_target / 12

  // Event-SQL target weighted onto the months its events actually run.
  const eventByMm: Record<string, number> = {}
  for (const ev of events) {
    const months = quarterMonths(ev.quarter)
    if (!months.length) continue
    const goal = ((ev.sql_target_min ?? 0) + (ev.sql_target_max ?? 0)) / 2
    const per = goal / months.length
    months.forEach(mm => { eventByMm[mm] = (eventByMm[mm] ?? 0) + per })
  }

  const targetFor = (key: MetricKey, mm: string): number => {
    const ev = eventByMm[mm] ?? 0
    switch (key) {
      case 'mql':    return MQL_M
      case 'direct': return DIR_M
      case 'event':  return ev
      case 'sql':    return DIR_M + ev
      case 'total':  return MQL_M + DIR_M + ev
      case 'seats':  return SEATS_M
    }
  }

  const annualTarget: Record<MetricKey, number> = {
    mql: t.digital_mqls, sql: t.annual_sqls, direct: t.digital_sqls, event: t.event_sqls,
    total: t.digital_mqls + t.annual_sqls, seats: settings.annual_seats_target,
  }

  const rows = FISCAL_MONTHS.map(fm => {
    const year = ['01', '02', '03'].includes(fm.mm) ? fyStart + 1 : fyStart
    const ym = `${year}-${fm.mm}`
    const ml = leads.filter(l => (l.lead_date ?? '').startsWith(ym))
    const cat = (l: Lead) => classifyLeadSource(l.lead_source)
    const direct = ml.filter(l => cat(l) === 'Direct SQL').length
    const event = ml.filter(l => cat(l) === 'Event SQL').length
    const mql = ml.filter(l => cat(l) === 'Digital MQL').length
    const seats = leads
      .filter(l => l.lead_stage === 'Closed Won' && (l.closed_date ?? '').startsWith(ym))
      .reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
    const actual: Record<MetricKey, number> = { mql, sql: direct + event, direct, event, total: mql + direct + event, seats }
    return { ym, mm: fm.mm, name: fm.name, future: ym > todayYm, actual }
  })

  const elapsed = rows.filter(r => r.ym <= todayYm)
  const ytd = (k: MetricKey) => elapsed.reduce((s, r) => s + r.actual[k], 0)
  const targetToDate = (k: MetricKey) => elapsed.reduce((s, r) => s + targetFor(k, r.mm), 0)

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-indigo-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Goal vs Achievement — {fiscalYearLabel(fyStart)}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Annual goal: <b>{settings.annual_seats_target} seats</b> · <b>{t.digital_mqls} MQL</b> · <b>{t.annual_sqls} SQL</b> ({t.digital_sqls} Direct + {t.event_sqls} Event).
        MQL &amp; Direct SQL split evenly; <b>Event SQL weighted to event months</b> from the event plan.
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
                  const a = r.actual[m.key], tg = targetFor(m.key, r.mm)
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
