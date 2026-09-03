import type { Lead } from '@/types'
import { leadBucket, isSql, hoursToSeats, formatSeats, FUNNEL_PLAN } from '@/lib/leads'
import { Target } from 'lucide-react'

const CAL_MONTHS: [string, string][] = [
  ['01', 'Jan'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Apr'], ['05', 'May'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Aug'], ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
]

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
const num = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(/\.0$/, ''))

export default function MonthlyGoalTracker({ leads }: { leads: Lead[] }) {
  const today = new Date()
  const year = today.getFullYear()
  const todayYm = today.toISOString().slice(0, 7)

  const rows = CAL_MONTHS.map(([mm, name]) => {
    const ym = `${year}-${mm}`
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
    return { ym, name, future: ym > todayYm, actual }
  })

  const elapsed = rows.filter(r => r.ym <= todayYm)
  // Seats = booked deals (Closed Won) — count all in the year, even future-dated
  // prepaid ones. MQL/SQL are volume by lead_date, so only elapsed months count.
  const ytd = (k: MetricKey) => (k === 'seats' ? rows : elapsed).reduce((s, r) => s + r.actual[k], 0)
  const toDate = (k: MetricKey) => MONTHLY[k] * elapsed.length

  const cards: MetricKey[] = ['totMql', 'digSql', 'evSql', 'ssgSql', 'totSql', 'seats']

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-indigo-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Goal vs Achievement — {year}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Plan for {FUNNEL_PLAN.seatsTotal} new-business seats (+{FUNNEL_PLAN.upgradeSeats} upgrades tracked separately = {FUNNEL_PLAN.seatsTotal + FUNNEL_PLAN.upgradeSeats} total):
        <b> {ANNUAL.totMql} MQL</b> · <b>{ANNUAL.totSql} SQL</b> (Dig {P.Digital.sql} / Event {P.Event.sql} / SSG {P.SSG.sql}) ·
        <b> {FUNNEL_PLAN.meetingsYear} meetings/yr</b> ≈ {Math.round(FUNNEL_PLAN.meetingsYear / 12)}/mo across {FUNNEL_PLAN.reps} reps.
        MQL = every lead · SQL = completed meeting.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        {cards.map(k => {
          const a = ytd(k), td = toDate(k), ann = ANNUAL[k]
          const ap = ann > 0 ? a / ann : 0     // achieved, % of annual goal
          const tp = ann > 0 ? td / ann : 0     // target pace, % of year elapsed
          const badge = ap >= tp ? 'bg-emerald-50 text-emerald-700' : ap >= tp * 0.6 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          const label = METRICS.find(m => m.key === k)!.label
          return (
            <div key={k} className="rounded-xl ring-1 ring-slate-100 px-3 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-lg font-extrabold text-slate-800 tabular-nums mt-0.5">
                {k === 'seats' ? formatSeats(a) : a}<span className="text-[11px] text-slate-400 font-bold"> / {num(td)}</span>
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-[9px] font-bold rounded px-1 py-0.5 ${badge}`}>Ach {Math.round(ap * 100)}%</span>
                <span className="text-[9px] font-bold text-slate-400">Tgt {Math.round(tp * 100)}%</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">goal {ann}/yr</p>
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
                  // future months are blank, EXCEPT already-booked seats (prepaid deals)
                  const blank = r.future && !(m.key === 'seats' && a > 0)
                  return (
                    <td key={m.key} className="py-2.5 px-2.5 text-right tabular-nums">
                      <span className={`font-bold ${blank ? 'text-slate-300' : tone(a, tg, false)}`}>{blank ? '—' : (m.key === 'seats' ? formatSeats(a) : a)}</span>
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
