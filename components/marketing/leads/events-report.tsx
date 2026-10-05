'use client'

import { useState, useMemo } from 'react'
import type { Lead } from '@/types'
import { leadBucket, isSql, hoursToSeats, formatSeats } from '@/lib/leads'
import { CalendarCheck2, X } from 'lucide-react'

export default function EventsReport({ leads }: { leads: Lead[] }) {
  const year = new Date().getFullYear().toString()
  const [active, setActive] = useState<string | null>(null)

  const { rows, tot, byEvent } = useMemo(() => {
    const evLeads = leads.filter(l => leadBucket(l.lead_source) === 'Event' && (l.lead_date ?? '').startsWith(year))
    const m = new Map<string, Lead[]>()
    for (const l of evLeads) {
      const ev = (l.data_source ?? '').trim() || 'Unlabelled'
      if (!m.has(ev)) m.set(ev, [])
      m.get(ev)!.push(l)
    }
    const rows = [...m.entries()].map(([event, ls]) => ({
      event, count: ls.length,
      meetings: ls.filter(l => l.successful_meetings).length,
      sql: ls.filter(isSql).length,
      won: ls.filter(l => l.lead_stage === 'Closed Won').length,
      seats: ls.filter(l => l.lead_stage === 'Closed Won').reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0),
    })).sort((a, b) => b.count - a.count)
    const tot = rows.reduce((a, r) => ({ count: a.count + r.count, meetings: a.meetings + r.meetings, sql: a.sql + r.sql, won: a.won + r.won, seats: a.seats + r.seats }), { count: 0, meetings: 0, sql: 0, won: 0, seats: 0 })
    return { rows, tot, byEvent: m }
  }, [leads, year])

  const rate = (s: number, n: number) => (n ? `${Math.round((s / n) * 100)}%` : '—')

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center"><CalendarCheck2 className="h-4 w-4 text-fuchsia-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Events Report — {year}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Per-event performance (Lead Source = Event, grouped by Data Source). Click an event for its leads. Meetings = successful meetings · SQL = completed meeting · Seats = closed won.</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-8 text-center">No event leads this year yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-left font-bold uppercase tracking-wider py-2 pl-1">Event</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Leads</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Meetings</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">SQL</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Lead→SQL</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Deals</th>
                <th className="text-right font-bold uppercase tracking-wider py-2 px-3">Seats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => (
                <tr key={r.event} onClick={() => setActive(r.event)} className="hover:bg-fuchsia-50/40 cursor-pointer transition-colors">
                  <td className="py-2.5 pl-1 font-semibold text-slate-700">{r.event}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{r.count}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-amber-600 font-semibold">{r.meetings}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-blue-600">{r.sql}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">{rate(r.sql, r.count)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{r.won}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-600">{r.seats > 0 ? formatSeats(r.seats) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-extrabold">
                <td className="py-2.5 pl-1 text-slate-800">Total · {rows.length} events</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-800">{tot.count}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">{tot.meetings}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-blue-700">{tot.sql}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">{rate(tot.sql, tot.count)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{tot.won}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{formatSeats(tot.seats)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {active && <EventModal event={active} leads={byEvent.get(active) ?? []} onClose={() => setActive(null)} />}
    </div>
  )
}

function EventModal({ event, leads, onClose }: { event: string; leads: Lead[]; onClose: () => void }) {
  const meetings = leads.filter(l => l.successful_meetings).length
  const sql = leads.filter(isSql).length
  const sorted = [...leads].sort((a, b) => (b.lead_date ?? '').localeCompare(a.lead_date ?? ''))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600">
          <div>
            <p className="text-sm font-extrabold text-white">{event}</p>
            <p className="text-[11px] text-white/75">{leads.length} leads · {meetings} meetings · {sql} SQL</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" aria-label="Close"><X className="h-4 w-4 text-white" /></button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
              <tr>
                {['#', 'Name', 'Company', 'Stage', 'Mtg', 'SQL', 'Seats', 'Assigned'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((l, i) => (
                <tr key={l.id} className="hover:bg-fuchsia-50/30">
                  <td className="px-4 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{l.name || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.company_name || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.lead_stage || '—'}</td>
                  <td className="px-4 py-2.5">{l.successful_meetings ? <span className="text-amber-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5">{isSql(l) ? <span className="text-blue-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 font-semibold">{l.lead_stage === 'Closed Won' && (l.closed_hours ?? 0) > 0 ? formatSeats(hoursToSeats(l.closed_hours ?? 0)) : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{l.assigned_to || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
