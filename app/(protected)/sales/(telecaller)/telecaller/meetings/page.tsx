'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, Loader2, CalendarCheck, ChevronUp, ChevronDown, Search, CheckCircle2, XCircle, RotateCcw, TrendingUp, Clock, ThumbsDown, Trophy } from 'lucide-react'
import { Modal } from '@/components/sales/ui/Modal'
import { formatShortDate } from '@/lib/utils'
import { TIMEZONES, COMPANY_SIZES } from '@/lib/types'
import type { Meeting, MeetingOutcome, MeetingResult } from '@/lib/types'

const today = new Date().toISOString().split('T')[0]

const emptyForm = {
  first_name: '', last_name: '', company_name: '', company_size: '',
  meeting_date: today, meeting_time: '', timezone: 'IST', lead_source: '', notes: '',
}

type SortKey = 'name' | 'company_name' | 'meeting_date' | 'lead_source'

const COLS = [
  { key: 'name' as SortKey,         label: 'Name',        sortable: true,  w: 'min-w-[160px]' },
  { key: 'company_name' as SortKey, label: 'Company',     sortable: true,  w: 'min-w-[150px]' },
  { key: null,                       label: 'Size',        sortable: false, w: 'min-w-[100px]' },
  { key: 'lead_source' as SortKey,  label: 'Lead Source', sortable: true,  w: 'min-w-[130px]' },
  { key: 'meeting_date' as SortKey, label: 'Date & Time', sortable: true,  w: 'min-w-[160px]' },
  { key: null,                       label: 'Outcome',     sortable: false, w: 'min-w-[140px]' },
  { key: null,                       label: 'Result',      sortable: false, w: 'min-w-[180px]' },
  { key: null,                       label: 'Notes',       sortable: false, w: 'min-w-[160px]' },
  { key: null,                       label: '',            sortable: false, w: 'w-[72px]' },
]

const OUTCOME_OPTIONS: { value: MeetingOutcome; label: string; color: string; icon: React.ElementType }[] = [
  { value: 'completed',   label: 'Completed',   color: 'text-[#34C759] bg-green-50 border-green-200',   icon: CheckCircle2 },
  { value: 'closed_won',  label: 'Closed Won',  color: 'text-[#7C3AED] bg-purple-50 border-purple-200', icon: Trophy },
  { value: 'cancelled',   label: 'Cancelled',   color: 'text-[#DC2626] bg-red-50 border-red-200',       icon: XCircle },
  { value: 'rescheduled', label: 'Rescheduled', color: 'text-[#FF9500] bg-orange-50 border-orange-200', icon: RotateCcw },
]

function OutcomeBadge({ outcome }: { outcome: MeetingOutcome | null }) {
  if (!outcome) return <span className="text-[#AEAEB2] text-[12px]">—</span>
  const opt = OUTCOME_OPTIONS.find(o => o.value === outcome)
  if (!opt) return null
  const Icon = opt.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${opt.color}`}>
      <Icon size={10} /> {opt.label}
    </span>
  )
}

function OutcomeDropdown({ meeting, onUpdate }: { meeting: Meeting; onUpdate: (updated: Meeting) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  if (meeting.meeting_date >= today) return <OutcomeBadge outcome={meeting.outcome} />

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, left: r.left })
    }
    setErr(''); setOpen(o => !o)
  }

  async function setOutcome(value: MeetingOutcome | null) {
    setSaving(true); setErr(''); setOpen(false)
    const res = await fetch('/api/telecaller/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: meeting.id, outcome: value }),
    })
    const d = await res.json()
    if (res.ok) { onUpdate(d.meeting as Meeting) } else { setErr(d.error ?? 'Failed to save.') }
    setSaving(false)
  }

  return (
    <div>
      <button ref={btnRef} onClick={handleOpen} disabled={saving}
        className="flex items-center gap-1.5 text-[12px] font-medium hover:opacity-80 transition">
        {saving ? <Loader2 size={12} className="animate-spin text-[#AEAEB2]" /> : <OutcomeBadge outcome={meeting.outcome} />}
        {!saving && !meeting.outcome && (
          <span className="text-[11px] text-[#DC2626] border border-[#DC2626]/30 rounded-full px-2 py-0.5 hover:bg-red-50 transition">Set outcome</span>
        )}
      </button>
      {err && <p className="text-[10px] text-red-500 mt-0.5 max-w-[140px] leading-tight">{err}</p>}

      {open && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div className="bg-white rounded-xl border border-[#E5E5EA] py-1 min-w-[160px]"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            {OUTCOME_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button key={opt.value} onClick={() => setOutcome(opt.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[#F5F5F7] transition text-left ${meeting.outcome === opt.value ? 'font-semibold' : ''}`}>
                  <Icon size={13} className={opt.color.split(' ')[0]} /> {opt.label}
                </button>
              )
            })}
            {meeting.outcome && (
              <button onClick={() => setOutcome(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#AEAEB2] hover:bg-[#F5F5F7] transition border-t border-[#F2F2F7] mt-1 text-left">
                Clear outcome
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

const RESULT_OPTIONS: { value: MeetingResult; label: string; color: string; icon: React.ElementType }[] = [
  { value: 'converted_opportunity', label: 'Converted to Opportunity', color: 'text-[#34C759] bg-green-50 border-green-200',  icon: TrendingUp },
  { value: 'future_followup',       label: 'Future Follow-up',         color: 'text-[#3B82F6] bg-blue-50 border-blue-200',    icon: Clock },
  { value: 'lost',                  label: 'Lost',                     color: 'text-[#6E6E73] bg-[#F5F5F7] border-[#E5E5EA]', icon: ThumbsDown },
]

function ResultBadge({ result }: { result: MeetingResult | null }) {
  if (!result) return null
  const opt = RESULT_OPTIONS.find(o => o.value === result)
  if (!opt) return null
  const Icon = opt.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${opt.color}`}>
      <Icon size={10} /> {opt.label}
    </span>
  )
}

function ResultDropdown({ meeting, onUpdate }: { meeting: Meeting; onUpdate: (updated: Meeting) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  if (meeting.meeting_date >= today) {
    return <span className="text-[#AEAEB2] text-[12px]">—</span>
  }

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, left: r.left })
    }
    setErr(''); setOpen(o => !o)
  }

  async function setResult(value: MeetingResult | null) {
    setSaving(true); setErr(''); setOpen(false)
    const res = await fetch('/api/telecaller/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: meeting.id, result: value }),
    })
    const d = await res.json()
    if (res.ok) { onUpdate(d.meeting as Meeting) } else { setErr(d.error ?? 'Failed to save.') }
    setSaving(false)
  }

  return (
    <div>
      <button ref={btnRef} onClick={handleOpen} disabled={saving}
        className="flex items-center gap-1.5 text-[12px] font-medium hover:opacity-80 transition"
      >
        {saving
          ? <Loader2 size={12} className="animate-spin text-[#AEAEB2]" />
          : meeting.result
          ? <ResultBadge result={meeting.result} />
          : <span className="text-[11px] text-[#3B82F6] border border-[#3B82F6]/30 rounded-full px-2 py-0.5 hover:bg-blue-50 transition whitespace-nowrap">
              What happened? →
            </span>
        }
      </button>

      {err && <p className="text-[10px] text-red-500 mt-0.5 max-w-[180px] leading-tight">{err}</p>}

      {open && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div className="bg-white rounded-xl border border-[#E5E5EA] py-1 min-w-[210px]"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <p className="px-3 py-1.5 text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Meeting result</p>
            {RESULT_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button key={opt.value} onClick={() => setResult(opt.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-[#F5F5F7] transition text-left ${meeting.result === opt.value ? 'font-semibold' : ''}`}>
                  <Icon size={14} className={opt.color.split(' ')[0]} /> {opt.label}
                </button>
              )
            })}
            {meeting.result && (
              <button onClick={() => setResult(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#AEAEB2] hover:bg-[#F5F5F7] transition border-t border-[#F2F2F7] mt-1 text-left">
                Clear result
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ ...emptyForm })
  const [sortKey, setSortKey] = useState<SortKey>('meeting_date')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/telecaller/meetings')
    const data = await res.json()
    setMeetings(data.meetings ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditingId(null); setForm({ ...emptyForm }); setError(''); setModalOpen(true)
  }

  function openEdit(m: Meeting) {
    setEditingId(m.id)
    setForm({
      first_name: m.first_name, last_name: m.last_name,
      company_name: m.company_name, company_size: m.company_size ?? '',
      meeting_date: m.meeting_date, meeting_time: m.meeting_time.slice(0, 5),
      timezone: m.timezone, lead_source: m.lead_source ?? '', notes: m.notes ?? '',
    })
    setError(''); setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.company_name.trim() || !form.meeting_date || !form.meeting_time) {
      setError('First name, last name, company, date and time are required.'); return
    }
    setSaving(true); setError('')
    const res = await fetch('/api/telecaller/meetings', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setModalOpen(false); await load(); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this meeting?')) return
    await fetch('/api/telecaller/meetings', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  function handleOutcomeUpdate(updated: Meeting) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = meetings.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.company_name.toLowerCase().includes(q) ||
      (m.lead_source ?? '').toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let va = '', vb = ''
    if (sortKey === 'meeting_date') { va = a.meeting_date + a.meeting_time; vb = b.meeting_date + b.meeting_time }
    else if (sortKey === 'name') { va = a.first_name + a.last_name; vb = b.first_name + b.last_name }
    else if (sortKey === 'company_name') { va = a.company_name; vb = b.company_name }
    else if (sortKey === 'lead_source') { va = a.lead_source ?? ''; vb = b.lead_source ?? '' }
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const upcoming = sorted.filter(m => m.meeting_date >= today)
  const past = sorted.filter(m => m.meeting_date < today)

  const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

  const TH = ({ col }: { col: typeof COLS[number] }) => (
    <th
      className={`px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap bg-[#FAFAFA] border-b border-[#E5E5EA] ${col.w} ${col.sortable ? 'cursor-pointer select-none hover:text-[#6E6E73]' : ''}`}
      onClick={col.key ? () => toggleSort(col.key as SortKey) : undefined}
    >
      <div className="flex items-center gap-1">
        {col.label}
        {col.sortable && col.key && (
          sortKey === col.key
            ? (sortAsc ? <ChevronUp size={12} className="text-[#DC2626]" /> : <ChevronDown size={12} className="text-[#DC2626]" />)
            : <ChevronUp size={12} className="text-[#D1D1D6]" />
        )}
      </div>
    </th>
  )

  function DataRows({ rows, dimmed }: { rows: Meeting[]; dimmed?: boolean }) {
    return (
      <>
        {rows.map((m) => (
          <tr
            key={m.id}
            className={`group border-b border-[#F2F2F7] hover:bg-[#FAFAFA] transition-colors ${dimmed ? 'opacity-70' : ''}`}
          >
            <td className="px-4 py-3">
              <span className="font-semibold text-[#1D1D1F] text-[13px] whitespace-nowrap">{m.first_name} {m.last_name}</span>
            </td>
            <td className="px-4 py-3">
              <span className="text-[#6E6E73] text-[13px] block max-w-[140px] truncate">{m.company_name}</span>
            </td>
            <td className="px-4 py-3">
              {m.company_size
                ? <span className="inline-block px-2 py-0.5 rounded bg-[#F2F2F7] text-[#6E6E73] text-[11px] font-medium whitespace-nowrap">{m.company_size}</span>
                : <span className="text-[#D1D1D6] text-[13px]">—</span>}
            </td>
            <td className="px-4 py-3">
              {m.lead_source
                ? <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[11px] font-semibold whitespace-nowrap border border-blue-100">{m.lead_source}</span>
                : <span className="text-[#D1D1D6] text-[13px]">—</span>}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <p className="text-[13px] font-medium text-[#1D1D1F]">{formatShortDate(m.meeting_date)}</p>
              <p className="text-[11px] text-[#AEAEB2]">{m.meeting_time.slice(0, 5)} {m.timezone}</p>
            </td>
            <td className="px-4 py-3">
              <OutcomeDropdown meeting={m} onUpdate={handleOutcomeUpdate} />
            </td>
            <td className="px-4 py-3">
              <ResultDropdown meeting={m} onUpdate={handleOutcomeUpdate} />
            </td>
            <td className="px-4 py-3">
              <span className="text-[12px] text-[#AEAEB2] italic block max-w-[180px] truncate">{m.notes || '—'}</span>
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-0.5">
                <button onClick={() => openEdit(m)} title="Edit"
                  className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition cursor-pointer">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(m.id)} title="Delete"
                  className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#FF3B30] hover:bg-red-50 transition cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b border-[#E5E5EA] bg-white">
        <div className="flex-1">
          <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Meetings</h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            {meetings.length > 0
              ? `${upcoming.length} upcoming · ${past.length} past · ${meetings.length} total`
              : 'Log every booked meeting with full contact details'}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition self-start sm:self-auto flex-shrink-0">
          <Plus size={15} /> Log Meeting
        </button>
      </div>

      {/* Search */}
      {meetings.length > 0 && (
        <div className="px-6 py-3 border-b border-[#F2F2F7] bg-white flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, company, source…"
              className="w-full pl-8 pr-3 py-2 border border-[#E5E5EA] rounded-lg text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA]"
            />
          </div>
          {search && (
            <button onClick={() => setSearch('')} className="text-[12px] text-[#AEAEB2] hover:text-[#6E6E73] transition">Clear</button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-[#DC2626]" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center mb-4">
            <CalendarCheck size={24} className="text-[#AEAEB2]" />
          </div>
          <p className="font-semibold text-[#1D1D1F]">No meetings logged yet</p>
          <p className="text-[13px] text-[#6E6E73] mt-1 mb-4">Tap &ldquo;Log Meeting&rdquo; whenever you book a call</p>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
            <Plus size={15} /> Log your first meeting
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-12">
          <div>
            <p className="font-medium text-[#6E6E73]">No results for &ldquo;{search}&rdquo;</p>
            <button onClick={() => setSearch('')} className="text-[13px] text-[#DC2626] mt-1 hover:underline">Clear search</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 800 }}>
            <thead className="sticky top-0 z-10">
              <tr>{COLS.map((col, i) => <TH key={i} col={col} />)}</tr>
            </thead>
            <tbody>
              {upcoming.length > 0 && (
                <>
                  <tr>
                    <td colSpan={COLS.length} className="px-4 py-2 bg-green-50 border-y border-green-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#34C759] inline-block" />
                        <span className="text-[11px] font-bold text-green-700 uppercase tracking-wider">Upcoming</span>
                        <span className="text-[11px] text-green-600 font-medium">{upcoming.length} meeting{upcoming.length !== 1 ? 's' : ''}</span>
                      </div>
                    </td>
                  </tr>
                  <DataRows rows={upcoming} />
                </>
              )}
              {past.length > 0 && (
                <>
                  <tr>
                    <td colSpan={COLS.length} className="px-4 py-2 bg-[#F5F5F7] border-y border-[#E5E5EA]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#AEAEB2] inline-block" />
                        <span className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider">Past</span>
                        <span className="text-[11px] text-[#AEAEB2] font-medium">{past.length} meeting{past.length !== 1 ? 's' : ''}</span>
                        <span className="text-[11px] text-[#AEAEB2] ml-2">— click Outcome to mark result</span>
                      </div>
                    </td>
                  </tr>
                  <DataRows rows={past} dimmed />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Meeting' : 'Log Booked Meeting'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">First Name *</label>
              <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="John" className={inputCls} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Last Name *</label>
              <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Smith" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Company Name *</label>
            <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="Acme Corp" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Company Size</label>
              <select value={form.company_size} onChange={e => setForm(f => ({ ...f, company_size: e.target.value }))}
                className={`${inputCls} bg-white`}>
                <option value="">Select…</option>
                {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Lead Source</label>
              <input value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}
                placeholder="e.g. LinkedIn, Cold Call…" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Meeting Date *</label>
              <input type="date" value={form.meeting_date}
                onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Time *</label>
              <input type="time" value={form.meeting_time}
                onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Timezone *</label>
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className={`${inputCls} bg-white`}>
              {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Context, what was discussed…" rows={2} className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-red-600 text-[13px]">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 border border-[#E5E5EA] text-[#6E6E73] rounded-xl py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-[#DC2626] hover:bg-[#C91C1C] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Saving…' : editingId ? 'Update Meeting' : 'Log Meeting'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
