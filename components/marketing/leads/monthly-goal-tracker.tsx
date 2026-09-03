import type { Settings, Lead, PlanEvent } from '@/types'
import { deriveTargets } from '@/lib/calculations'
import {
  leadBucket, isSql, hoursToSeats, formatSeats,
  FISCAL_MONTHS, FISCAL_QUARTERS, fiscalYearStart, fiscalYearLabel,
} from '@/lib/leads'
import { Target } from 'lucide-react'

type MetricKey = 'digMql' | 'digSql' | 'evMql' | 'evSql' | 'totMql' | 'totSql' | 'seats'

const METRICS: { key: MetricKey; label: string; targeted: boolean }[] = [
  { key: 'digMql', label: 'Digital MQL', targeted: false },
  { key: 'digSql', label: 'Digital SQL', targeted: true },
  { key: 'evMql',  label: 'Event MQL',   targeted: false },
  { key: 'evSql',  label: 'Event SQL',   targeted: true },
  { key: 'totMql', label: 'Total MQL',   targeted: true },
  { key: 'totSql', label: 'Total SQL',   targeted: true },
  { key: 'seats',  label: 'Seats',       targeted: true },
]

function tone(actual: number, target: number, future: boolean) {
  if (future) return 'text-slate-300'
  if (target <= 0) return 'text-slate-400'
  const p = actual / target
  return p >= 1 ? 'text-emerald-600' : p >= 0.6 ? 'text-amber-600' : 'text-rose-600'
}
const pct = (a: number, t: number) => (t <= 0 ? '—' : `${Math.round((a / t) * 100)}%`)
const num = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(/\.0$/, ''))

function quarterMonths(quarter: string): string[] {
  const out: string[] = []
  for (const p of String(quarter).split(/[–-]/).map(x => x.trim())) {
    const q = FISCAL_QUARTERS.find(fq => fq.label === p)
    if (q) out.push(...q.months)
  }
  return out
}

export default function MonthlyGoalTracker({ leads, settings, events }: { leads: Lead[]; settings: Settings; events: PlanEvent[] }) {
  const t = deriveTargets(settings)
  const today = new Date()
  const fyStart = fiscalYearStart(today)
  const todayYm = today.toISOString().slice(0, 7)

  const MQL_M = t.digital_mqls / 12       // total MQL 834
  const DIGSQL_M = t.digital_sqls / 12    // Digital SQL 250
  const SEATS_M = settings.annual_seats_target / 12

  // Event SQL (150) weighted to event months
  const eventByMm: Record<string, number> = {}
  for (const ev of events) {
    const months = quarterMonths(ev.quarter); if (!months.length) continue
    const goal = ((ev.sql_target_min ?? 0) + (ev.sql_target_max ?? 0)) / 2
    months.forEach(mm => { eventByMm[mm] = (eventByMm[mm] ?? 0) + goal / months.length })
  }

  const targetFor = (key: MetricKey, mm: string): number | null => {
    const ev = eventByMm[mm] ?? 0
    switch (key) {
      case 'digMql': return null
      case 'evMql':  return null
      case 'digSql': return DIGSQL_M
      case 'evSql':  return ev
      case 'totMql': return MQL_M
      case 'totSql': return DIGSQL_M + ev
      case 'seats':  return SEATS_M
    }
  }

  const annualTarget: Record<MetricKey, number | null> = {
    digMql: null, evMql: null,
    digSql: t.digital_sqls, evSql: t.event_sqls, totMql: t.digital_mqls, totSql: t.annual_sqls, seats: settings.annual_seats_target,
  }

  const rows = FISCAL_MONTHS.map(fm => {
    const year = ['01', '02', '03'].includes(fm.mm) ? fyStart + 1 : fyStart
    const ym = `${year}-${fm.mm}`
    const ml = leads.filter(l => (l.lead_date ?? '').startsWith(ym))
    const dig = ml.filter(l => leadBucket(l.lead_source) === 'Digital')
    const evl = ml.filter(l => leadBucket(l.lead_source) === 'Event')
    const digSql = dig.filter(isSql).length, evSql = evl.filter(isSql).length
    const seats = leads.filter(l => l.lead_stage === 'Closed Won' && (l.closed_date ?? '').startsWith(ym))
      .reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
    const actual: Record<MetricKey, number> = {
      digMql: dig.length, evMql: evl.length, digSql, evSql,
      totMql: ml.length, totSql: digSql + evSql, seats,
    }
    return { ym, mm: fm.mm, name: fm.name, future: ym > todayYm, actual }
  })

  const elapsed = rows.filter(r => r.ym <= todayYm)
  const ytd = (k: MetricKey) => elapsed.reduce((s, r) => s + r.actual[k], 0)
  const targetToDate = (k: MetricKey) => elapsed.reduce((s, r) => s + (targetFor(k, r.mm) ?? 0), 0)

  const cards = METRICS.filter(m => m.targeted)

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-indigo-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Goal vs Achievement — {fiscalYearLabel(fyStart)}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        <b>MQL = every lead</b> ({t.digital_mqls}/yr). <b>SQL = completed meeting</b> ({t.annual_sqls}/yr: {t.digital_sqls} Digital + {t.event_sqls} Event). Buckets: Digital = all non-Event sources · Event = Event source. Seats goal {settings.annual_seats_target}.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {cards.map(m => {
          const a = ytd(m.key), td = targetToDate(m.key)
          const p = td > 0 ? a / td : 0
          const badge = p >= 1 ? 'bg-emerald-50 text-emerald-700' : p >= 0.6 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          return (
            <div key={m.key} className="rounded-xl ring-1 ring-slate-100 px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
              <p className="text-xl font-extrabold text-slate-800 tabular-nums mt-0.5">
                {m.key === 'seats' ? formatSeats(a) : a}<span className="text-xs text-slate-400 font-bold"> / {num(td)}</span>
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${badge}`}>{pct(a, td)} to date</span>
                <span className="text-[10px] text-slate-400">of {annualTarget[m.key]}/yr</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Month</th>
              {METRICS.map(m => (
                <th key={m.key} className="text-right font-bold uppercase tracking-wider py-2 px-3">{m.label}<span className="block text-[9px] font-medium text-slate-300 normal-case">{m.targeted ? 'act / tgt' : 'act'}</span></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => (
              <tr key={r.ym} className={`${r.ym === todayYm ? 'bg-indigo-50/40' : ''} hover:bg-slate-50/60`}>
                <td className="py-2.5 pl-1 font-semibold text-slate-700">{r.name}{r.ym === todayYm ? ' •' : ''}</td>
                {METRICS.map(m => {
                  const a = r.actual[m.key], tg = targetFor(m.key, r.mm)
                  const disp = r.future ? '—' : (m.key === 'seats' ? formatSeats(a) : a)
                  return (
                    <td key={m.key} className="py-2.5 px-3 text-right tabular-nums">
                      {m.targeted
                        ? <><span className={`font-bold ${tone(a, tg ?? 0, r.future)}`}>{disp}</span><span className="text-slate-300"> / {num(tg ?? 0)}</span></>
                        : <span className={`font-semibold ${r.future ? 'text-slate-300' : 'text-slate-600'}`}>{disp}</span>}
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
                    {m.targeted
                      ? <><span className={tone(a, td, false)}>{m.key === 'seats' ? formatSeats(a) : a}</span><span className="text-slate-300"> / {num(td)}</span></>
                      : <span className="text-slate-600">{a}</span>}
                  </td>
                )
              })}
            </tr>
            <tr className="text-slate-400">
              <td className="py-1.5 pl-1 text-[10px] uppercase tracking-wider">Annual goal</td>
              {METRICS.map(m => <td key={m.key} className="py-1.5 px-3 text-right tabular-nums text-slate-500 font-bold">{annualTarget[m.key] ?? '—'}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
