import type { Settings, Lead } from '@/types'
import { deriveTargets } from '@/lib/calculations'
import { classifyLeadSource, hoursToSeats, formatSeats } from '@/lib/leads'
import { CalendarRange } from 'lucide-react'

type MetricKey = 'mql' | 'sql' | 'direct' | 'event' | 'seats'
const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'mql', label: 'MQL' }, { key: 'sql', label: 'SQL' },
  { key: 'direct', label: 'Direct SQL' }, { key: 'event', label: 'Event SQL' }, { key: 'seats', label: 'Seats' },
]
const WEEKS = 12

function mondayOf(d: Date) {
  const x = new Date(d); const day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1)); x.setHours(0, 0, 0, 0); return x
}
const iso = (d: Date) => d.toISOString().slice(0, 10)
function tone(a: number, t: number) {
  if (t <= 0) return 'text-slate-400'
  const p = a / t
  return p >= 1 ? 'text-emerald-600' : p >= 0.6 ? 'text-amber-600' : 'text-rose-600'
}
const num = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(/\.0$/, ''))

export default function WeeklyAchievement({ leads, settings }: { leads: Lead[]; settings: Settings }) {
  const t = deriveTargets(settings)
  const wt: Record<MetricKey, number> = {
    mql: t.digital_mqls / 52, sql: t.annual_sqls / 52, direct: t.digital_sqls / 52,
    event: t.event_sqls / 52, seats: settings.annual_seats_target / 52,
  }

  const thisMon = mondayOf(new Date())
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const from = new Date(thisMon); from.setDate(thisMon.getDate() - (WEEKS - 1 - i) * 7)
    const to = new Date(from); to.setDate(from.getDate() + 6)
    const f = iso(from), tt = iso(to)
    const inRange = (dt: string | null | undefined, a: string, b: string) => !!dt && dt >= a && dt <= b
    const ml = leads.filter(l => inRange(l.lead_date, f, tt))
    const cat = (l: Lead) => classifyLeadSource(l.lead_source)
    const direct = ml.filter(l => cat(l) === 'Direct SQL').length
    const event = ml.filter(l => cat(l) === 'Event SQL').length
    const mql = ml.filter(l => cat(l) === 'Digital MQL').length
    const seats = leads.filter(l => l.lead_stage === 'Closed Won' && inRange(l.closed_date, f, tt))
      .reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
    const label = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { label, current: i === WEEKS - 1, actual: { mql, sql: direct + event, direct, event, seats } as Record<MetricKey, number> }
  })

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center"><CalendarRange className="h-4 w-4 text-violet-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Weekly Achievement — last {WEEKS} weeks</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Weekly run-rate vs pace (annual ÷ 52): MQL {num(wt.mql)} · SQL {num(wt.sql)} · Direct {num(wt.direct)} · Event {num(wt.event)} · Seats {num(wt.seats)} per week.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Week of</th>
              {METRICS.map(m => <th key={m.key} className="text-right font-bold uppercase tracking-wider py-2 px-3">{m.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {weeks.map(w => (
              <tr key={w.label} className={`${w.current ? 'bg-violet-50/40' : ''} hover:bg-slate-50/60`}>
                <td className="py-2 pl-1 font-semibold text-slate-700">{w.label}{w.current ? ' •' : ''}</td>
                {METRICS.map(m => (
                  <td key={m.key} className="py-2 px-3 text-right tabular-nums">
                    <span className={`font-bold ${tone(w.actual[m.key], wt[m.key])}`}>{m.key === 'seats' ? formatSeats(w.actual[m.key]) : w.actual[m.key]}</span>
                    <span className="text-slate-300"> / {num(wt[m.key])}</span>
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
