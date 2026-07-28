'use client'

import { useState, useMemo } from 'react'

type L = {
  name: string
  company_name: string
  lead_source: string
  email: string
  phone: string
  loss_reason: string
}

export default function LossReasonBreakdown({ leads }: { leads: L[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, L[]>()
    for (const l of leads) {
      const k = (l.loss_reason || '').trim()
      if (!k) continue
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(l)
    }
    return [...m.entries()]
      .map(([reason, items]) => ({ reason, items }))
      .sort((a, b) => b.items.length - a.items.length)
  }, [leads])

  const max = Math.max(1, ...groups.map(g => g.items.length))
  const [selected, setSelected] = useState<string | null>(null)
  const selectedItems = selected ? groups.find(g => g.reason === selected)?.items ?? [] : []

  if (groups.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No outcome reasons recorded yet</p>
  }

  return (
    <div className="pt-2">
      <div className="space-y-1.5">
        {groups.map(g => {
          const active = selected === g.reason
          return (
            <button key={g.reason} onClick={() => setSelected(active ? null : g.reason)}
              className="w-full block" title="Click to see these leads">
              <div className="flex items-center gap-2 text-[12px]">
                <span className={`w-36 sm:w-44 truncate text-left ${active ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>{g.reason}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                  <div className={`h-full rounded transition-all ${active ? 'bg-rose-500' : 'bg-rose-300 hover:bg-rose-400'}`}
                    style={{ width: `${(g.items.length / max) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums text-slate-700 font-medium">{g.items.length}</span>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-slate-800">
              {selected} · {selectedItems.length} lead{selectedItems.length !== 1 ? 's' : ''}
            </p>
            <button onClick={() => setSelected(null)} className="text-[11px] text-slate-400 hover:text-slate-600">clear</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-3 py-1.5 font-medium">Name</th>
                  <th className="px-3 py-1.5 font-medium">Company</th>
                  <th className="px-3 py-1.5 font-medium">Lead Source</th>
                  <th className="px-3 py-1.5 font-medium">Email</th>
                  <th className="px-3 py-1.5 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {selectedItems.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-800 font-medium whitespace-nowrap">{l.name || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{l.company_name || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{l.lead_source || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                      {l.email ? <a href={`mailto:${l.email}`} className="text-rose-600 hover:underline">{l.email}</a> : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                      {l.phone ? <a href={`tel:${l.phone}`} className="hover:underline">{l.phone}</a> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
