'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { Panel } from '@/components/marketing/ui/panel'
import { CalendarCheck, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lead } from '@/types'

const MONTHS = 12

interface MonthMeta { key: string; label: string; from: string; to: string }

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MeetingsModal({ owner, month, leads, onClose }: { owner: string; month: MonthMeta; leads: Lead[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-white font-extrabold text-lg">{owner} — Successful Meetings, {month.label}</h3>
            <p className="text-amber-50 text-xs mt-0.5">{leads.length} successful meeting{leads.length !== 1 ? 's' : ''} (by lead date)</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        {leads.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm py-12">No successful meetings in {month.label}</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Name', 'Company', 'Lead Date', 'Lead Source', 'Status', 'Stage', 'Outcome', 'Assigned'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{l.name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.company_name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap tabular-nums">{fmtDate(l.lead_date)}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.lead_source || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.lead_status || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.lead_stage || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{l.meeting_outcome || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{l.assigned_to || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// One card = one person. `match` finds the person in the free-text Assigned To column
// (e.g. "Maanoj", "Maanoj Shah", "Piyush + Sharvari" all count for their first name).
export default function MeetingsByOwner({ leads, owner, match, color }: {
  leads: Lead[]
  owner: string
  match: RegExp
  color: string
}) {
  const [offset, setOffset] = useState(0)
  const [activeMonth, setActiveMonth] = useState<MonthMeta | null>(null)

  const mine = useMemo(() => leads.filter(l => l.successful_meetings && match.test(l.assigned_to ?? '')), [leads, match])

  const { data, months } = useMemo(() => {
    const today = new Date()
    const anchor = new Date(today.getFullYear(), today.getMonth() - offset * MONTHS, 1)
    const months: MonthMeta[] = Array.from({ length: MONTHS }, (_, i) => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - (MONTHS - 1 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      return { key, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` }
    })
    const data = months.map(m => ({
      name: m.label,
      meetings: mine.filter(l => (l.lead_date ?? '') >= m.from && (l.lead_date ?? '') <= m.to).length,
    }))
    return { data, months }
  }, [mine, offset])

  const visibleTotal = data.reduce((s, d) => s + d.meetings, 0)
  const modalLeads = useMemo(() => {
    if (!activeMonth) return []
    return mine.filter(l => (l.lead_date ?? '') >= activeMonth.from && (l.lead_date ?? '') <= activeMonth.to)
      .sort((a, b) => (b.lead_date ?? '').localeCompare(a.lead_date ?? ''))
  }, [mine, activeMonth])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (state: any) => {
    if (!state?.activeLabel) return
    const m = months.find(m => m.label === state.activeLabel)
    if (m) setActiveMonth(m)
  }

  return (
    <>
      <Panel icon={CalendarCheck} title={`Successful Meetings — ${owner}`} accent="amber"
        caption={`${months[0].label} – ${months[months.length - 1].label} · ${visibleTotal} meetings · click any bar for details`}>
        <div style={{ height: 220 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 4 }} barCategoryGap="30%" onClick={handleClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid vertical={false} stroke="#eef0f5" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }} formatter={(v) => [String(v), 'Successful meetings']} />
              <Bar dataKey="meetings" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="meetings" position="top" fontSize={10} fontWeight={700} fill="#64748b"
                  formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[11px] text-slate-400">Month = lead date of the meeting lead</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(o => o + 1)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button onClick={() => setOffset(o => o - 1)} disabled={offset === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Panel>
      {activeMonth && <MeetingsModal owner={owner} month={activeMonth} leads={modalLeads} onClose={() => setActiveMonth(null)} />}
    </>
  )
}
