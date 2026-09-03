import type { Lead } from '@/types'
import { leadBucket, isSql, hoursToSeats, FUNNEL_PLAN, type Channel3 } from '@/lib/leads'
import { Gauge } from 'lucide-react'

const CH: Channel3[] = ['Digital', 'Event', 'SSG']
// Minimum SQL->Seat close = plan seats / plan SQL per channel.
const minClose = (c: Channel3) => FUNNEL_PLAN.channels[c].seats / FUNNEL_PLAN.channels[c].sql

export default function CloseRateTracker({ leads }: { leads: Lead[] }) {
  const agg: Record<Channel3, { sql: number; seats: number }> = {
    Digital: { sql: 0, seats: 0 }, Event: { sql: 0, seats: 0 }, SSG: { sql: 0, seats: 0 },
  }
  for (const l of leads) {
    const b = leadBucket(l.lead_source)
    if (isSql(l)) agg[b].sql++
    if (l.lead_stage === 'Closed Won') agg[b].seats += hoursToSeats(l.closed_hours ?? 0)
  }
  const totSql = CH.reduce((s, c) => s + agg[c].sql, 0)
  const totSeats = CH.reduce((s, c) => s + agg[c].seats, 0)

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center"><Gauge className="h-4 w-4 text-rose-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Close Rate vs Minimum</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        SQL → Seat conversion (seats closed ÷ completed meetings). Below the minimum = a sales-conversion issue, not a lead issue.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Channel</th>
              <th className="text-right font-bold uppercase tracking-wider py-2 px-3">SQL</th>
              <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Seats</th>
              <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Actual close</th>
              <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Minimum</th>
              <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {CH.map(c => {
              const v = agg[c]
              const close = v.sql ? v.seats / v.sql : 0
              const mn = minClose(c)
              const ok = close >= mn
              return (
                <tr key={c} className="hover:bg-slate-50/60">
                  <td className="py-2.5 pl-1 font-semibold text-slate-700">{c}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{v.sql}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{v.seats.toFixed(2)}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums font-bold ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>{(close * 100).toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-400">{(mn * 100).toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{ok ? '✓ OK' : '⚠ below'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-extrabold">
              <td className="py-2.5 pl-1 text-slate-800">Blended</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{totSql}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{totSeats.toFixed(2)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-800">{totSql ? (totSeats / totSql * 100).toFixed(1) : '0'}%</td>
              <td className="py-2.5 px-3 text-right" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
