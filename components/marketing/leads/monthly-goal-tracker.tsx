import type { Lead } from '@/types'
import {
  leadBucket, isSql, hoursToSeats, formatSeats, FUNNEL_PLAN,
  FISCAL_MONTHS, fiscalYearStart, fiscalYearLabel,
} from '@/lib/leads'
import { Target } from 'lucide-react'

type MetricKey = 'digMql' | 'digSql' | 'evMql' | 'evSql' | 'ssgMql' | 'ssgSql' | 'totMql' | 'totSql' | 'seats'

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'digMql', label: 'Digital MQL' }, { key: 'digSql', label: 'Digital SQL' },
  { key: 'evMql',  label: 'Event MQL'   }, { key: 'evSql',  label: 'Event SQL'   },
  { key: 'ssgMql', label: 'SSG MQL'     }, { key: 'ssgSql', label: 'SSG SQL'     },
  { key: 'totMql', label: 'Total MQL'   }, { key: 'totSql', label: 'Total SQL'   },
  { key: 'seats',  label: 'Seats'       },
]

const P = FUNNEL_PLAN.channels
const ANNUAL: Record<MetricKey, number> = {
  digMql: P.Digital.mql, digSql: P.Digital.sql,
  evMql: P.Event.mql,   evSql: P.Event.sql,
  ssgMql: P.SSG.mql,    ssgSql: P.SSG.sql,
  totMql: P.Digital.mql + P.Event.mql + P.SSG.mql,
  totSql: P.Digital.sql + P.Event.sql + P.SSG.sql,
  seats: FUNNEL_PLAN.seatsTotal,
}
const MONTHLY: Record<MetricKey, number> = Object.fromEntries(
  (Object.keys(ANNUAL) as MetricKey[]).map(k => [k, ANNUAL[k] / 12])
) as Record<MetricKey, number>

function tone(a: number, t: number, future: boolean) {
  if (future) return 'text-slate-300'
  if (t <= 0) return 'text-slate-400'
  const p = a / t
  return p >= 1 ? 'text-emerald-600' : p >= 0.6 ? 'text-amber-600' : 'text-rose-600'
}
const pct = (a: number, t: number) => (t <= 0 ? '—' : `${Math.round((a / t) * 100)}%`)
const num = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(/\.0$/, ''))

export default function MonthlyGoalTracker({ leads }: { leads: Lead[] }) {
  const today = new Date()
  const fyStart = fiscalYearStart(today)
  const todayYm = today.toISOString().slice(0, 7)

  const rows = FISCAL_MONTHS.map(fm => {
    const year = ['01', '02', '03'].includes(fm.mm) ? fyStart + 1 : fyStart
    const ym = `${year}-${fm.mm}`
    const ml = leads.filter(l => (l.lead_date ?? '').startsWith(ym))
    const dig = ml.filter(l => leadBucket(l.lead_source) === 'Digital')
    const evl = ml.filter(l => leadBucket(l.lead_source) === 'Event')
    const ssg = ml.filter(l => leadBucket(l.lead_source) === 'SSG')
    const digSql = dig.filter(isSql).length, evSql = evl.filter(isSql).length, ssgSql = ssg.filter(isSql).length
    const seats = leads.filter(l => l.lead_stage === 'Closed Won' && (l.closed_date ?? '').startsWith(ym))
      .reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
    const actual: Record<MetricKey, number> = {
      digMql: dig.length, digSql, evMql: evl.length, evSql, ssgMql: ssg.length, ssgSql,
      totMql: ml.length, totSql: digSql + evSql + ssgSql, seats,
    }
    return { ym, name: fm.name, future: ym > todayYm, actual }
  })

  const elapsed = rows.filter(r => r.ym <= todayYm)
  const ytd = (k: MetricKey) => elapsed.reduce((s, r) => s + r.actual[k], 0)
  const toDate = (k: MetricKey) => MONTHLY[k] * elapsed.length

  const cards: MetricKey[] = ['totMql', 'digSql', 'evSql', 'ssgSql', 'totSql', 'seats']

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-indigo-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Goal vs Achievement — {fiscalYearLabel(fyStart)}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Plan for {FUNNEL_PLAN.seatsTotal} seats ({FUNNEL_PLAN.seatsTotal - FUNNEL_PLAN.upgradeSeats} new + {FUNNEL_PLAN.upgradeSeats} upgrades):
        <b> {ANNUAL.totMql} MQL</b> · <b>{ANNUAL.totSql} SQL</b> (Dig {P.Digital.sql} / Event {P.Event.sql} / SSG {P.SSG.sql}) ·
        <b> {FUNNEL_PLAN.meetingsYear} meetings/yr</b> ≈ {Math.round(FUNNEL_PLAN.meetingsYear / 12)}/mo across {FUNNEL_PLAN.reps} reps.
        MQL = every lead · SQL = completed meeting.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        {cards.map(k => {
          const a = ytd(k), td = toDate(k), p = td > 0 ? a / td : 0
          const badge = p >= 1 ? 'bg-emerald-50 text-emerald-700' : p >= 0.6 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          const label = METRICS.find(m => m.key === k)!.label
          return (
            <div key={k} className="rounded-xl ring-1 ring-slate-100 px-3 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-lg font-extrabold text-slate-800 tabular-nums mt-0.5">
                {k === 'seats' ? formatSeats(a) : a}<span className="text-[11px] text-slate-400 font-bold"> / {num(td)}</span>
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[9px] font-bold rounded px-1 py-0.5 ${badge}`}>{pct(a, td)}</span>
                <span className="text-[9px] text-slate-400">{ANNUAL[k]}/yr</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Month</th>
              {METRICS.map(m => <th key={m.key} className="text-right font-bold uppercase tracking-wider py-2 px-2.5">{m.label}<span className="block text-[9px] font-medium text-slate-300 normal-case">act / tgt</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => (
              <tr key={r.ym} className={`${r.ym === todayYm ? 'bg-indigo-50/40' : ''} hover:bg-slate-50/60`}>
                <td className="py-2.5 pl-1 font-semibold text-slate-700">{r.name}{r.ym === todayYm ? ' •' : ''}</td>
                {METRICS.map(m => {
                  const a = r.actual[m.key], tg = MONTHLY[m.key]
                  return (
                    <td key={m.key} className="py-2.5 px-2.5 text-right tabular-nums">
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
                const a = ytd(m.key), td = toDate(m.key)
                return (
                  <td key={m.key} className="py-2.5 px-2.5 text-right tabular-nums">
                    <span className={tone(a, td, false)}>{m.key === 'seats' ? formatSeats(a) : a}</span>
                    <span className="text-slate-300"> / {num(td)}</span>
                  </td>
                )
              })}
            </tr>
            <tr className="text-slate-400">
              <td className="py-1.5 pl-1 text-[10px] uppercase tracking-wider">Annual goal</td>
              {METRICS.map(m => <td key={m.key} className="py-1.5 px-2.5 text-right tabular-nums text-slate-500 font-bold">{ANNUAL[m.key]}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
