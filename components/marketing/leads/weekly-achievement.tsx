import type { Lead } from '@/types'
import { leadBucket, isSql, hoursToSeats, formatSeats, FUNNEL_PLAN } from '@/lib/leads'
import { CalendarRange } from 'lucide-react'

type MetricKey = 'digMql' | 'digSql' | 'evMql' | 'evSql' | 'ssgMql' | 'ssgSql' | 'totMql' | 'totSql' | 'seats'
const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'digMql', label: 'Digital MQL' }, { key: 'digSql', label: 'Digital SQL' },
  { key: 'evMql',  label: 'Event MQL'   }, { key: 'evSql',  label: 'Event SQL'   },
  { key: 'ssgMql', label: 'SSG MQL'     }, { key: 'ssgSql', label: 'SSG SQL'     },
  { key: 'totMql', label: 'Total MQL'   }, { key: 'totSql', label: 'Total SQL'   },
  { key: 'seats',  label: 'Seats'       },
]
const WEEKS = 12
const P = FUNNEL_PLAN.channels
const ANNUAL: Record<MetricKey, number> = {
  digMql: P.Digital.mql, digSql: P.Digital.sql, evMql: P.Event.mql, evSql: P.Event.sql,
  ssgMql: P.SSG.mql, ssgSql: P.SSG.sql,
  totMql: P.Digital.mql + P.Event.mql + P.SSG.mql, totSql: P.Digital.sql + P.Event.sql + P.SSG.sql,
  seats: FUNNEL_PLAN.seatsTotal,
}
const WK: Record<MetricKey, number> = Object.fromEntries(
  (Object.keys(ANNUAL) as MetricKey[]).map(k => [k, ANNUAL[k] / 52])
) as Record<MetricKey, number>

function mondayOf(d: Date) { const x = new Date(d); const g = x.getDay(); x.setDate(x.getDate() - (g === 0 ? 6 : g - 1)); x.setHours(0, 0, 0, 0); return x }
const iso = (d: Date) => d.toISOString().slice(0, 10)
function tone(a: number, t: number) { if (t <= 0) return 'text-slate-400'; const p = a / t; return p >= 1 ? 'text-emerald-600' : p >= 0.6 ? 'text-amber-600' : 'text-rose-600' }
const num = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(/\.0$/, ''))

export default function WeeklyAchievement({ leads }: { leads: Lead[] }) {
  const thisMon = mondayOf(new Date())
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const from = new Date(thisMon); from.setDate(thisMon.getDate() - (WEEKS - 1 - i) * 7)
    const to = new Date(from); to.setDate(from.getDate() + 6)
    const f = iso(from), tt = iso(to)
    const inR = (dt: string | null | undefined, a: string, b: string) => !!dt && dt >= a && dt <= b
    const ml = leads.filter(l => inR(l.lead_date, f, tt))
    const dig = ml.filter(l => leadBucket(l.lead_source) === 'Digital')
    const evl = ml.filter(l => leadBucket(l.lead_source) === 'Event')
    const ssg = ml.filter(l => leadBucket(l.lead_source) === 'SSG')
    const digSql = dig.filter(isSql).length, evSql = evl.filter(isSql).length, ssgSql = ssg.filter(isSql).length
    const seats = leads.filter(l => l.lead_stage === 'Closed Won' && inR(l.closed_date, f, tt))
      .reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
    const actual: Record<MetricKey, number> = {
      digMql: dig.length, digSql, evMql: evl.length, evSql, ssgMql: ssg.length, ssgSql,
      totMql: ml.length, totSql: digSql + evSql + ssgSql, seats,
    }
    return { label: from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), current: i === WEEKS - 1, actual }
  })

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center"><CalendarRange className="h-4 w-4 text-violet-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Weekly Achievement — last {WEEKS} weeks</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Weekly pace (annual ÷ 52): Total MQL {num(WK.totMql)} · Total SQL {num(WK.totSql)} · Seats {num(WK.seats)} /wk. MQL = every lead; SQL = completed meeting.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Week of</th>
              {METRICS.map(m => <th key={m.key} className="text-right font-bold uppercase tracking-wider py-2 px-2.5">{m.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {weeks.map(w => (
              <tr key={w.label} className={`${w.current ? 'bg-violet-50/40' : ''} hover:bg-slate-50/60`}>
                <td className="py-2 pl-1 font-semibold text-slate-700">{w.label}{w.current ? ' •' : ''}</td>
                {METRICS.map(m => (
                  <td key={m.key} className="py-2 px-2.5 text-right tabular-nums">
                    <span className={`font-bold ${tone(w.actual[m.key], WK[m.key])}`}>{m.key === 'seats' ? formatSeats(w.actual[m.key]) : w.actual[m.key]}</span>
                    <span className="text-slate-300"> / {num(WK[m.key])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
