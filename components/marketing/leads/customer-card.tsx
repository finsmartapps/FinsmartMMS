'use client'

import { useState } from 'react'
import { Trophy, X, ArrowUpRight, Mail, Phone, Globe, Briefcase, User } from 'lucide-react'
import type { Lead } from '@/types'

interface Props {
  customers: Lead[]
  opportunityCount: number
}

const TYPE_COLOR: Record<string, string> = {
  'NBEC': 'bg-amber-50 text-amber-700 ring-amber-200',
  'NBNC': 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
}

export default function CustomerCard({ customers, opportunityCount }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Card — same style as the other RollupCards */}
      <button
        onClick={() => setOpen(true)}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-pink-700 p-5 hover-lift glow-violet text-left w-full transition hover:opacity-90 active:scale-[0.98]"
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" aria-hidden />
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25 mb-3">
            <Trophy className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />
          </div>
          <p className="text-3xl font-extrabold text-white leading-none tabular-nums">{customers.length}</p>
          <p className="text-[11px] font-bold text-white/75 uppercase tracking-widest mt-2">Customers</p>
          <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1 leading-tight">
            <ArrowUpRight className="h-3 w-3 shrink-0" />
            {opportunityCount > 0 ? `+ ${opportunityCount} opportunities` : 'Closed Won with revenue'}
          </p>
        </div>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Customers</h2>
                <p className="text-xs text-slate-400 mt-0.5">{customers.length} total · Closed Won with revenue</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              {customers.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No customers yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr>
                      {['Name', 'Company', 'Contact', 'Source', 'Service', 'Assigned To', 'Type'].map(h => (
                        <th key={h} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {customers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-500 flex items-center justify-center shrink-0">
                              <User size={12} className="text-white" />
                            </div>
                            {c.name || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Briefcase size={12} className="text-slate-300 shrink-0" />
                            {c.company_name || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {c.email && (
                              <div className="flex items-center gap-1 text-slate-500 text-xs">
                                <Mail size={10} className="text-slate-300 shrink-0" />
                                <span className="truncate max-w-[160px]">{c.email}</span>
                              </div>
                            )}
                            {c.phone && (
                              <div className="flex items-center gap-1 text-slate-500 text-xs">
                                <Phone size={10} className="text-slate-300 shrink-0" />
                                {c.phone}
                              </div>
                            )}
                            {c.website_url && (
                              <div className="flex items-center gap-1 text-slate-500 text-xs">
                                <Globe size={10} className="text-slate-300 shrink-0" />
                                <span className="truncate max-w-[160px]">{c.website_url.replace(/^https?:\/\//, '')}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{c.lead_source || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{c.service_required || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{c.assigned_to || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${TYPE_COLOR[c.customer_type?.trim().toUpperCase() ?? ''] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                            {c.customer_type || 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    ))}
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
