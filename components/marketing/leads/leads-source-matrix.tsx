import type { Lead } from '@/types'
import { LEAD_SOURCES } from '@/lib/leads'
import { Grid3x3 } from 'lucide-react'

const MONTHS = [
  ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'], ['05', 'May'], ['06', 'June'],
  ['07', 'July'], ['08', 'August'], ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
]

export default function LeadsSourceMatrix({ leads }: { leads: Lead[] }) {
  const year = new Date().getFullYear().toString()
  const yearLeads = leads.filter(l => (l.lead_date ?? '').startsWith(year))

  const sources = [...LEAD_SOURCES] as string[]
  // any lead_source outside the known list → "Other"
  const hasOther = yearLeads.some(l => l.lead_source && !sources.includes(l.lead_source))
  const cols = hasOther ? [...sources, 'Other'] : sources

  const cell = (mm: string, src: string) => yearLeads.filter(l => {
    if (!(l.lead_date ?? '').startsWith(`${year}-${mm}`)) return false
    if (src === 'Other') return l.lead_source && !sources.includes(l.lead_source)
    return l.lead_source === src
  }).length

  const rows = MONTHS.map(([mm, name]) => {
    const counts = cols.map(c => cell(mm, c))
    return { name, counts, total: counts.reduce((a, b) => a + b, 0) }
  })
  const colTotals = cols.map((_, ci) => rows.reduce((a, r) => a + r.counts[ci], 0))
  const grand = colTotals.reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center"><Grid3x3 className="h-4 w-4 text-sky-600" /></div>
        <h2 className="text-base font-extrabold text-slate-800">Leads by Source × Month — {year}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="bg-sky-600 text-white">
              <th className="text-left font-bold py-2.5 px-3 rounded-l-lg">Month</th>
              {cols.map(c => <th key={c} className="text-right font-bold py-2.5 px-3 whitespace-nowrap">{c}</th>)}
              <th className="text-right font-bold py-2.5 px-3 rounded-r-lg">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => (
              <tr key={r.name} className="hover:bg-slate-50/60">
                <td className="py-2 px-3 font-semibold text-slate-700">{r.name}</td>
                {r.counts.map((v, i) => <td key={i} className={`py-2 px-3 text-right tabular-nums ${v ? 'text-slate-700' : 'text-slate-300'}`}>{v}</td>)}
                <td className="py-2 px-3 text-right font-extrabold tabular-nums text-slate-900">{r.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-sky-600 text-white font-extrabold">
              <td className="py-2.5 px-3 rounded-l-lg">Total</td>
              {colTotals.map((v, i) => <td key={i} className="py-2.5 px-3 text-right tabular-nums">{v}</td>)}
              <td className="py-2.5 px-3 text-right rounded-r-lg tabular-nums">{grand}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
