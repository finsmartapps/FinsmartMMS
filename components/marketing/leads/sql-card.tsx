'use client'

import { useState } from 'react'
import { Zap, X, ArrowUpRight, Mail, Phone, Briefcase, User } from 'lucide-react'
import type { Lead } from '@/types'

interface Props {
  sqls: Lead[]
  targetLabel?: string
}

const TYPE_COLOR: Record<string, string> = {
  'NBEC': 'bg-amber-50 text-amber-700 ring-amber-200',
  'NBNC': 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SqlCard({ sqls, targetLabel }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-5 hover-lift glow-emerald text-left w-full transition hover:opacity-90 active:scale-[0.98]"
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" aria-hidden />
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25 mb-3">
            <Zap className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />
          </div>
          <p className="text-3xl font-extrabold text-white leading-none tabular-nums">{sqls.length}</p>
          <p className="text-[11px] font-bold text-white/75 uppercase tracking-widest mt-2">SQLs</p>
          <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1 leading-tight">
            <ArrowUpRight className="h-3 w-3 shrink-0" />
            {targetLabel ?? 'Sales Qualified Leads'}
          </p>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-700 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25">
                  <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">SQL Leads</p>
                  <p className="text-[11px] text-white/70">{sqls.length} total · Sales Qualified Leads</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              {sqls.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No SQL leads yet.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                    <tr>
                      {['#', 'Name', 'Company', 'Source', 'Data Source', 'Type', 'Assigned To', 'Lead Date', 'Service'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sqls.map((l, i) => {
                      const ct = (l.customer_type ?? '').trim().toUpperCase()
                      return (
                        <tr key={l.id} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="px-4 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                                <User size={10} className="text-white" />
                              </div>
                              {l.name || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Briefcase size={11} className="text-slate-300 shrink-0" />
                              {l.company_name || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{l.lead_source || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{l.data_source || '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {ct ? (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${TYPE_COLOR[ct] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                                {ct}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{l.assigned_to || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">{fmtDate(l.lead_date)}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap max-w-[140px] truncate">{l.service_required || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
