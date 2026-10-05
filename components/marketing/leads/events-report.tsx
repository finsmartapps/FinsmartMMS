import type { Lead } from '@/types'
import { leadBucket, isSql, hoursToSeats, formatSeats } from '@/lib/leads'
import { CalendarCheck2 } from 'lucide-react'

export default function EventsReport({ leads }: { leads: Lead[] }) {
  const year = new Date().getFullYear().toString()
  const evLeads = leads.filter(l => leadBucket(l.lead_source) === 'Event' && (l.lead_date ?? '').startsWith(year))

  const map = new Map<string, { leads: number; sql: number; won: number; seats: number }>()
  for (const l of evLeads) {
    const ev = (l.data_source ?? '').trim() || 'Unlabelled'
    const r = map.get(ev) ?? { leads: 0, sql: 0, won: 0, seats: 0 }
    r.leads++
    if (isSql(l)) r.sql++
    if (l.lead_stage === 'Closed Won') { r.won++; r.seats += hoursToSeats(l.closed_hours ?? 0) }
    map.set(ev, r)
  }
  const rows = [...map.entries()].map(([event, v]) => ({ event, ...v })).sort((a, b) => b.leads - a.leads)
  const tot = rows.reduce((a, r) => ({ leads: a.leads + r.leads, sql: a.sql + r.sql, won: a.won + r.won, seats: a.seats + r.seats }), { leads: 0, sql: 0, won: 0, seats: 0 })
  const rate = (s: number, n: number) => (n ? `${Math.round((s / n) * 100)}%` : '—')

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center"><CalendarCheck2 className="h-4 w-4 text-fuchsia-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Events Report — {year}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Per-event performance (Lead Source = Event, grouped by Data Source). SQL = completed meeting · Seats = closed won.</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-8 text-center">No event leads this year yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Event</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Leads</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">SQL</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Lead→SQL</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Deals</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Seats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => (
                <tr key={r.event} className="hover:bg-slate-50/60">
                  <td className="py-2.5 pl-1 font-semibold text-slate-700">{r.event}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{r.leads}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-blue-600">{r.sql}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">{rate(r.sql, r.leads)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{r.won}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-600">{r.seats > 0 ? formatSeats(r.seats) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-extrabold">
                <td className="py-2.5 pl-1 text-slate-800">Total · {rows.length} events</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-800">{tot.leads}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-blue-700">{tot.sql}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">{rate(tot.sql, tot.leads)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{tot.won}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{formatSeats(tot.seats)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
