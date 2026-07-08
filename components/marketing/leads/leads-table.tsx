'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Panel } from '@/components/marketing/ui/panel'
import {
  LEAD_SOURCES, LEAD_FROM, LEAD_STAGES, classifyLeadSource, CATEGORY_STYLES, STATUS_STYLES,
  CLOSED_WON_STAGE, hoursToSeats, formatSeats,
} from '@/lib/leads'
import LeadFormModal from '@/components/marketing/leads/lead-form-modal'
import type { Lead } from '@/types'
import { Inbox, SlidersHorizontal, Pencil, Check, Trash2, Search, X } from 'lucide-react'

interface Props {
  leads: Lead[]
  dataSourceSuggestions: string[]
  industrySuggestions: string[]
  serviceSuggestions: string[]
  assigneeSuggestions: string[]
}

type ColKey = keyof Lead | 'seats'
const COLUMNS: { key: ColKey; label: string; def: boolean }[] = [
  { key: 'sr_no',           label: '#',             def: true  },
  { key: 'lead_date',       label: 'Date',          def: true  },
  { key: 'name',            label: 'Name',          def: true  },
  { key: 'email',           label: 'Email',         def: false },
  { key: 'phone',           label: 'Phone',         def: false },
  { key: 'company_name',    label: 'Company',       def: true  },
  { key: 'website_url',     label: 'Website',       def: false },
  { key: 'industry',        label: 'Industry',      def: false },
  { key: 'service_required',label: 'Service',       def: false },
  { key: 'lead_source',     label: 'Source',        def: true  },
  { key: 'category',        label: 'Category',      def: true  },
  { key: 'lead_from',       label: 'Lead From',     def: false },
  { key: 'data_source',     label: 'Data Source',   def: false },
  { key: 'state',           label: 'State',         def: false },
  { key: 'country',         label: 'Country',       def: false },
  { key: 'lead_stage',      label: 'Stage',         def: true  },
  { key: 'closed_hours',    label: 'Hours',         def: false },
  { key: 'seats',           label: 'Seats',         def: false },
  { key: 'mrr_value',       label: 'MRR',           def: false },
  { key: 'one_time_revenue',label: 'One-time',      def: false },
  { key: 'closed_date',     label: 'Closed',        def: false },
  { key: 'lead_status',     label: 'MQL/SQL',       def: true  },
  { key: 'assigned_to',     label: 'Owner',         def: true  },
  { key: 'customer_type',   label: 'Customer Type', def: false },
  { key: 'became_sql_date', label: 'Became SQL',    def: false },
  { key: 'comment',         label: 'Comment',       def: false },
]
const LS_KEY = 'finsmart.leads.cols.v1'
const DEFAULT_VIS = Object.fromEntries(COLUMNS.map(c => [c.key, c.def])) as Record<string, boolean>

export default function LeadsTable({ leads, ...suggestions }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [rows, setRows] = useState<Lead[]>(leads)
  const [visible, setVisible] = useState<Record<string, boolean>>(DEFAULT_VIS)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  // keep local rows in sync after router.refresh()
  useEffect(() => { setRows(leads) }, [leads])

  // load saved column prefs
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_KEY)
      if (s) setVisible(v => ({ ...v, ...JSON.parse(s) }))
    } catch { /* ignore */ }
  }, [])

  // close column menu on outside click
  useEffect(() => {
    function h(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function toggleCol(key: string) {
    setVisible(v => {
      const next = { ...v, [key]: !v[key] }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  function resetCols() {
    setVisible(DEFAULT_VIS)
    try { localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_VIS)) } catch { /* ignore */ }
  }

  async function updateField(id: string, patch: Partial<Lead>) {
    setSavingId(id)
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
    await supabase.from('leads').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setSavingId(null)
    router.refresh()
  }

  async function deleteLead(row: Lead) {
    if (!window.confirm(`Delete lead #${row.sr_no} "${row.name}"? This cannot be undone.`)) return
    setSavingId(row.id)
    setRows(rs => rs.filter(r => r.id !== row.id))
    const { error } = await supabase.from('leads').delete().eq('id', row.id)
    setSavingId(null)
    if (error) { setRows(leads); window.alert(`Could not delete: ${error.message}`); return }
    router.refresh()
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      )
    : rows

  const cols = COLUMNS.filter(c => visible[c.key])
  const visibleCount = cols.length

  return (
    <Panel
      icon={Inbox}
      title={q ? `All Leads (${filtered.length} of ${rows.length})` : `All Leads (${rows.length})`}
      accent="indigo"
      noPad
      action={
        <div className="flex items-center gap-2">
          {/* search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="h-8 pl-8 pr-7 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-slate-700 placeholder:text-slate-400 w-52"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white ring-1 ring-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Columns
            <span className="text-[10px] font-semibold text-slate-400">{visibleCount}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl ring-1 ring-slate-200 shadow-xl z-30 p-2 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Show columns</span>
                <button onClick={resetCols} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Reset</button>
              </div>
              {COLUMNS.map(c => (
                <button
                  key={c.key}
                  onClick={() => toggleCol(c.key)}
                  className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left"
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ring-1 ${visible[c.key] ? 'bg-indigo-600 ring-indigo-600' : 'bg-white ring-slate-300'}`}>
                    {visible[c.key] && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className="text-sm text-slate-700">{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      }
    >
      {filtered.length === 0 && q ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <Search className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No results for &ldquo;{search}&rdquo;</p>
          <p className="text-xs text-slate-400 mt-1">Try a different name or email.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <Inbox className="h-7 w-7 text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No leads yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">Use “Add Lead” or “Import” above to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                {cols.map((c, i) => (
                  <th key={c.key} className={`text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-3 text-left whitespace-nowrap ${i === 0 ? 'pl-5' : ''}`}>
                    {c.label}
                  </th>
                ))}
                <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-0">
                  {cols.map((c, i) => (
                    <td key={c.key} className={`py-2.5 px-3 align-middle ${i === 0 ? 'pl-5' : ''}`}>
                      {renderCell(row, c.key, { updateField, saving: savingId === row.id })}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 pr-5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(row)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit lead"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteLead(row)}
                      disabled={savingId === row.id}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 ml-1"
                      title="Delete lead"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing}
        {...suggestions}
      />
    </Panel>
  )
}

/* ── cell renderer ───────────────────────────────────────────── */
function renderCell(
  row: Lead,
  key: ColKey,
  ctx: { updateField: (id: string, patch: Partial<Lead>) => void; saving: boolean }
) {
  switch (key) {
    case 'sr_no':
      return <span className="text-slate-400 tabular-nums text-xs">{row.sr_no}</span>
    case 'lead_date':
    case 'closed_date':
      return <span className="text-slate-500 text-xs whitespace-nowrap">{(row[key] as string) || '—'}</span>
    case 'became_sql_date':
      return <InlineDate value={row.became_sql_date} saving={ctx.saving}
        onChange={v => ctx.updateField(row.id, { became_sql_date: v || null })} />
    case 'closed_hours':
      return <InlineNumber value={row.closed_hours} saving={ctx.saving}
        onChange={v => {
          const patch: Partial<Lead> = { closed_hours: v }
          if (v != null && row.lead_stage === CLOSED_WON_STAGE && !row.closed_date) {
            patch.closed_date = new Date().toISOString().split('T')[0]
          }
          ctx.updateField(row.id, patch)
        }} />
    case 'seats':
      return <span className="font-bold text-indigo-700 tabular-nums text-xs whitespace-nowrap">
        {row.closed_hours ? formatSeats(hoursToSeats(row.closed_hours)) : '—'}
      </span>
    case 'mrr_value':
      return <InlineNumber value={row.mrr_value} prefix="$" saving={ctx.saving}
        onChange={v => ctx.updateField(row.id, { mrr_value: v })} />
    case 'one_time_revenue':
      return <InlineNumber value={row.one_time_revenue} prefix="$" saving={ctx.saving}
        onChange={v => ctx.updateField(row.id, { one_time_revenue: v })} />
    case 'name':
      return <span className="font-semibold text-slate-800 whitespace-nowrap">{row.name}</span>
    case 'email':
    case 'website_url':
      return <span className="text-slate-500 text-xs whitespace-nowrap max-w-[200px] inline-block truncate align-middle">{(row[key] as string) || '—'}</span>
    case 'lead_source':
      return <InlineSelect value={row.lead_source} options={LEAD_SOURCES as readonly string[]} includeEmpty saving={ctx.saving}
        onChange={v => ctx.updateField(row.id, { lead_source: v, category: classifyLeadSource(v) })} />
    case 'lead_from':
      return <InlineSelect value={row.lead_from} options={LEAD_FROM} includeEmpty saving={ctx.saving}
        onChange={v => ctx.updateField(row.id, { lead_from: v })} />
    case 'category': {
      const cat = classifyLeadSource(row.lead_source)
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-0.5 ring-1 whitespace-nowrap ${CATEGORY_STYLES[cat].badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLES[cat].dot}`} />{cat}
        </span>
      )
    }
    case 'lead_stage':
      return <InlineSelect value={row.lead_stage} options={LEAD_STAGES} includeEmpty saving={ctx.saving}
        onChange={v => {
          const patch: Partial<Lead> = { lead_stage: v }
          // stamp a close date the moment a deal is marked won, so it lands in the seats stats
          if (v === CLOSED_WON_STAGE && !row.closed_date) patch.closed_date = new Date().toISOString().split('T')[0]
          ctx.updateField(row.id, patch)
        }} />
    case 'lead_status':
      return row.lead_status
        ? <span className={`inline-flex text-xs font-bold rounded-md px-2 py-0.5 whitespace-nowrap ${STATUS_STYLES[row.lead_status] ?? 'bg-slate-100 text-slate-600'}`}>{row.lead_status}</span>
        : <span className="text-slate-300 text-xs">—</span>
    default:
      return <span className="text-slate-600 text-sm whitespace-nowrap">{(row[key] as string) || '—'}</span>
  }
}

function InlineSelect({ value, options, onChange, saving, includeEmpty }: {
  value: string; options: readonly string[]; onChange: (v: string) => void; saving: boolean; includeEmpty?: boolean
}) {
  // keep an off-list current value (e.g. legacy "Opportunity" stage) selectable
  const opts = !value || options.includes(value) ? options : [value, ...options]
  return (
    <select
      value={value || ''}
      disabled={saving}
      onChange={e => onChange(e.target.value)}
      className="h-8 text-xs rounded-lg border border-slate-200 bg-white px-2 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-slate-700 disabled:opacity-50 cursor-pointer hover:border-indigo-300 transition-colors max-w-[160px]"
    >
      {includeEmpty && <option value="">—</option>}
      {opts.map(o => <option key={o} value={o}>{o.replace(' = Converted to Deal', '')}</option>)}
    </select>
  )
}

// Inline date input — used for "Became SQL Date" so MQL→SQL conversion
// can be stamped directly from the table without opening the edit form.
function InlineDate({ value, onChange, saving }: {
  value: string | null; onChange: (v: string) => void; saving: boolean
}) {
  return (
    <input
      type="date"
      value={value || ''}
      disabled={saving}
      onChange={e => onChange(e.target.value)}
      title={value ? `Became SQL: ${value}` : 'Set SQL conversion date'}
      className="h-8 text-xs rounded-lg border border-slate-200 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-slate-700 disabled:opacity-50 hover:border-emerald-300 transition-colors w-[130px]"
    />
  )
}

function InlineNumber({ value, onChange, saving, prefix }: {
  value: number | null; onChange: (v: number | null) => void; saving: boolean; prefix?: string
}) {
  const [val, setVal] = useState(value != null ? String(value) : '')
  useEffect(() => { setVal(value != null ? String(value) : '') }, [value])

  function commit() {
    const t = val.trim()
    const n = Number(t)
    const next = t === '' || Number.isNaN(n) ? null : n
    if (next !== (value ?? null)) onChange(next)
  }

  return (
    <div className="relative inline-flex items-center">
      {prefix && <span className="absolute left-2 text-xs text-slate-400 pointer-events-none">{prefix}</span>}
      <input
        type="number"
        value={val}
        disabled={saving}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className={`h-8 w-[84px] text-xs rounded-lg border border-slate-200 bg-white py-1 ${prefix ? 'pl-5 pr-2' : 'px-2'} focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-slate-700 disabled:opacity-50 hover:border-indigo-300 transition-colors`}
      />
    </div>
  )
}
