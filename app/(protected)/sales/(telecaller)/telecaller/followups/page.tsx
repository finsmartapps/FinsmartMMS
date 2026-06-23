'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ListTodo, CalendarDays, Building2, CheckCircle2, Clock, Loader2, Trash2, ChevronUp, ChevronDown, Search, Phone, Mail, Pencil } from 'lucide-react'
import { Modal } from '@/components/sales/ui/Modal'
import { formatShortDate } from '@/lib/utils'
import type { FollowUp } from '@/lib/types'

const today = new Date().toISOString().split('T')[0]

type SortKey = 'name' | 'company' | 'date'
type SortDir = 'asc' | 'desc'

const emptyForm = {
  first_name: '', last_name: '', company_name: '',
  phone: '', email: '', follow_up_date: today, notes: '',
}

export default function FollowUpsPage() {
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [form, setForm] = useState({ ...emptyForm })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/telecaller/followups')
    const data = await res.json()
    setFollowups(data.followups ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openModal() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setError('')
    setModalOpen(true)
  }

  function openEdit(fu: FollowUp) {
    setEditingId(fu.id)
    setForm({
      first_name: fu.first_name,
      last_name: fu.last_name,
      company_name: fu.company_name ?? '',
      phone: fu.phone ?? '',
      email: fu.email ?? '',
      follow_up_date: fu.follow_up_date,
      notes: fu.notes ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.follow_up_date) {
      setError('First name, last name, and date are required.'); return
    }
    setSaving(true); setError('')
    const res = await fetch('/api/telecaller/followups', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setModalOpen(false)
    await load()
    setSaving(false)
  }

  async function toggleStatus(fu: FollowUp) {
    const newStatus = fu.status === 'pending' ? 'done' : 'pending'
    await fetch('/api/telecaller/followups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fu.id, status: newStatus }),
    })
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this follow-up?')) return
    await fetch('/api/telecaller/followups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function sortFn(a: FollowUp, b: FollowUp) {
    let va = '', vb = ''
    if (sortKey === 'name') { va = `${a.first_name} ${a.last_name}`; vb = `${b.first_name} ${b.last_name}` }
    else if (sortKey === 'company') { va = a.company_name ?? ''; vb = b.company_name ?? '' }
    else { va = a.follow_up_date; vb = b.follow_up_date }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  }

  const q = search.trim().toLowerCase()
  const filtered = followups.filter(f =>
    !q ||
    `${f.first_name} ${f.last_name}`.toLowerCase().includes(q) ||
    (f.company_name ?? '').toLowerCase().includes(q) ||
    (f.phone ?? '').toLowerCase().includes(q) ||
    (f.email ?? '').toLowerCase().includes(q) ||
    (f.notes ?? '').toLowerCase().includes(q)
  )

  const pending = filtered.filter(f => f.status === 'pending').sort(sortFn)
  const done = filtered.filter(f => f.status === 'done').sort(sortFn)
  const pendingAll = followups.filter(f => f.status === 'pending')
  const doneAll = followups.filter(f => f.status === 'done')

  const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

  function SortTH({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col
    return (
      <th
        onClick={() => handleSort(col)}
        className="px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-[#6E6E73] transition-colors"
      >
        <span className="flex items-center gap-1">
          {label}
          {active
            ? sortDir === 'asc' ? <ChevronUp size={12} className="text-[#DC2626]" /> : <ChevronDown size={12} className="text-[#DC2626]" />
            : <ChevronUp size={12} className="text-[#D1D1D6]" />}
        </span>
      </th>
    )
  }

  function overdue(fu: FollowUp) {
    return fu.follow_up_date < today && fu.status === 'pending'
  }

  function Row({ fu }: { fu: FollowUp }) {
    const isDone = fu.status === 'done'
    const isOverdue = overdue(fu)
    return (
      <tr className={`group border-b border-[#F2F2F7] hover:bg-[#FAFAFA] transition-colors ${isDone ? 'opacity-55' : ''}`}>
        {/* Status toggle */}
        <td className="px-4 py-3 text-center w-10">
          <button
            onClick={() => toggleStatus(fu)}
            title={isDone ? 'Mark as pending' : 'Mark as called back'}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mx-auto transition ${
              isDone
                ? 'bg-[#34C759] border-[#34C759] hover:opacity-70'
                : isOverdue
                ? 'border-[#FF3B30] hover:bg-red-50'
                : 'border-[#D1D1D6] hover:border-[#34C759]'
            }`}
          >
            {isDone && <CheckCircle2 size={12} className="text-white" />}
          </button>
        </td>
        {/* Name */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`font-semibold text-[13px] ${isDone ? 'line-through text-[#AEAEB2]' : isOverdue ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>
            {fu.first_name} {fu.last_name}
          </span>
        </td>
        {/* Company */}
        <td className="px-4 py-3 max-w-[140px]">
          {fu.company_name
            ? <span className="flex items-center gap-1 text-[13px] text-[#6E6E73]"><Building2 size={11} className="text-[#AEAEB2] flex-shrink-0" /><span className="truncate">{fu.company_name}</span></span>
            : <span className="text-[#D1D1D6] text-[13px]">—</span>}
        </td>
        {/* Phone */}
        <td className="px-4 py-3 whitespace-nowrap">
          {fu.phone
            ? <a href={`tel:${fu.phone}`} className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] hover:text-[#DC2626] transition group/link">
                <Phone size={11} className="text-[#AEAEB2] group-hover/link:text-[#DC2626] transition" />
                {fu.phone}
              </a>
            : <span className="text-[#D1D1D6] text-[13px]">—</span>}
        </td>
        {/* Email */}
        <td className="px-4 py-3 max-w-[180px]">
          {fu.email
            ? <a href={`mailto:${fu.email}`} className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] hover:text-[#DC2626] transition truncate group/link">
                <Mail size={11} className="text-[#AEAEB2] group-hover/link:text-[#DC2626] transition flex-shrink-0" />
                <span className="truncate">{fu.email}</span>
              </a>
            : <span className="text-[#D1D1D6] text-[13px]">—</span>}
        </td>
        {/* Follow-up Date */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={11} className={isOverdue && !isDone ? 'text-[#FF3B30]' : 'text-[#AEAEB2]'} />
            <span className={`text-[13px] font-medium ${isOverdue && !isDone ? 'text-[#FF3B30]' : isDone ? 'text-[#AEAEB2]' : 'text-[#1D1D1F]'}`}>
              {isOverdue && !isDone ? 'Overdue · ' : ''}{formatShortDate(fu.follow_up_date)}
            </span>
          </div>
        </td>
        {/* Notes */}
        <td className="px-4 py-3 max-w-[200px]">
          <span className="text-[12px] text-[#AEAEB2] italic truncate block">{fu.notes || '—'}</span>
        </td>
        {/* Actions */}
        <td className="px-4 py-3 w-20">
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => openEdit(fu)}
              className="p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] rounded-lg transition"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => handleDelete(fu.id)}
              className="p-1.5 text-[#AEAEB2] hover:text-[#FF3B30] hover:bg-red-50 rounded-lg transition"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-[#E5E5EA] bg-white flex-shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Callback Reminders</h1>
          <p className="text-[#6E6E73] text-[13px] mt-0.5">
            {followups.length > 0
              ? `${pendingAll.length} pending · ${doneAll.length} called back`
              : 'Contacts who asked you to call them back after a certain date'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {followups.length > 0 && (
            <>
              <div className="bg-[#FAFAFA] border border-[#E5E5EA] rounded-xl px-4 py-2 text-center hidden sm:block">
                <p className="text-lg font-bold text-[#FF9500]">{pendingAll.length}</p>
                <p className="text-[10px] text-[#AEAEB2] uppercase tracking-wide">Pending</p>
              </div>
              <div className="bg-[#FAFAFA] border border-[#E5E5EA] rounded-xl px-4 py-2 text-center hidden sm:block">
                <p className="text-lg font-bold text-[#34C759]">{doneAll.length}</p>
                <p className="text-[10px] text-[#AEAEB2] uppercase tracking-wide">Called Back</p>
              </div>
            </>
          )}
          <button onClick={openModal}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
            <Plus size={16} /> Add Callback
          </button>
        </div>
      </div>

      {/* Search toolbar */}
      <div className="px-6 py-3 border-b border-[#F2F2F7] bg-white flex-shrink-0">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, company, phone, email…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#E5E5EA] rounded-xl bg-[#FAFAFA] text-[#1D1D1F] placeholder-[#AEAEB2] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin text-[#DC2626]" />
          </div>
        ) : followups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ListTodo size={40} className="text-[#E5E5EA] mb-3" />
            <p className="font-semibold text-[#6E6E73]">No callbacks scheduled</p>
            <p className="text-[13px] text-[#AEAEB2] mt-1 mb-5">When someone says &ldquo;call me back in X days&rdquo;, add them here</p>
            <button onClick={openModal}
              className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
              <Plus size={15} /> Add Callback
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: 780 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#FAFAFA] border-b border-[#E5E5EA]">
                <th className="px-4 py-3 w-10" />
                <SortTH col="name" label="Name" />
                <SortTH col="company" label="Company" />
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">Email</th>
                <SortTH col="date" label="Call Back On" />
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">

              {/* Pending */}
              {pending.length > 0 && (
                <>
                  <tr>
                    <td colSpan={8} className="px-4 py-2 bg-orange-50 border-y border-orange-100">
                      <div className="flex items-center gap-2">
                        <Clock size={11} className="text-[#FF9500]" />
                        <span className="text-[11px] font-semibold text-[#FF9500] uppercase tracking-wider">
                          Pending · {pending.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {pending.map(fu => <Row key={fu.id} fu={fu} />)}
                </>
              )}

              {/* Done */}
              {done.length > 0 && (
                <>
                  <tr>
                    <td colSpan={8} className="px-4 py-2 bg-[#F2F2F7] border-y border-[#E5E5EA]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={11} className="text-[#34C759]" />
                        <span className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider">
                          Called Back · {done.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {done.map(fu => <Row key={fu.id} fu={fu} />)}
                </>
              )}

              {/* No search results */}
              {q && pending.length === 0 && done.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-[#AEAEB2] text-sm">No results for &ldquo;{search}&rdquo;</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Follow-up Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Callback Reminder' : 'Add Callback Reminder'}>
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
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Company Name</label>
            <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="Acme Corp (optional)" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Phone / Mobile</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 000 0000" className={inputCls} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@acme.com" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Call Back On *</label>
            <input type="date" value={form.follow_up_date}
              onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
              className={inputCls} />
            <p className="text-[11px] text-[#AEAEB2] mt-1">The date they asked you to call them back</p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Interested in plan X, asked to call back after salary credit…"
              rows={2} className={`${inputCls} resize-none`} />
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
              {saving ? 'Saving…' : editingId ? 'Update Reminder' : 'Add Callback'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
