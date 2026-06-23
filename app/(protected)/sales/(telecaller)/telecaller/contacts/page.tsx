'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Network, Send, Users, Clock, Loader2, CheckCircle2, Search,
  ExternalLink, ChevronLeft, ChevronRight, BookOpen, Download,
  Trash2, Tag, List, ChevronDown, X, UserPlus,
} from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import { ListsModal } from '@/components/sales/linkedin/ListsModal'
import type { LinkedInContactDetail } from '@/components/sales/linkedin/ContactDetailModal'
import { GEO_COUNTRIES, getStatesForCountry } from '@/lib/geo'

type Contact = LinkedInContactDetail

interface LinkedInList { id: string; name: string; description: string | null; contact_count: number }
interface Stats { totalAssigned: number; totalSent: number; totalPending: number }
interface Pipeline { new?: number; contacted?: number; interested?: number; won?: number; lost?: number }

const PIPELINE_STAGES = [
  { value: 'new', label: 'New', bg: 'bg-[#F5F5F7]', text: 'text-[#6E6E73]', border: 'border-[#E5E5EA]' },
  { value: 'contacted', label: 'Contacted', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  { value: 'interested', label: 'Interested', bg: 'bg-orange-50', text: 'text-[#FF9500]', border: 'border-orange-100' },
  { value: 'won', label: 'Won', bg: 'bg-green-50', text: 'text-[#34C759]', border: 'border-green-100' },
  { value: 'lost', label: 'Lost', bg: 'bg-red-50', text: 'text-[#FF3B30]', border: 'border-red-100' },
]

function getPipelineStyle(stage: string | null | undefined) {
  const found = PIPELINE_STAGES.find(s => s.value === stage)
  return found ?? { label: stage ?? '—', bg: 'bg-[#F5F5F7]', text: 'text-[#6E6E73]', border: 'border-[#E5E5EA]' }
}

function exportContactsCSV(contacts: Contact[]) {
  const rows = [
    ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Job Title', 'City', 'Country', 'Lead Source', 'LinkedIn URL', 'Status', 'Pipeline Stage', 'Request Sent On', 'Notes'],
    ...contacts.map(c => [
      c.first_name, c.last_name ?? '', c.email ?? '', c.phone ?? '',
      c.company_name ?? '', c.job_title ?? '', c.city ?? '', c.country ?? '',
      c.lead_source ?? '', c.linkedin_url ?? '',
      c.status === 'request_sent' ? 'Request Sent' : 'Pending',
      c.pipeline_status ?? '',
      c.request_sent_at ? c.request_sent_at.split('T')[0] : '',
      c.notes ?? '',
    ]),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `my-contacts.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── AddToListDropdown ─────────────────────────────────────────────────────────
function AddToListDropdown({ lists, onSelect }: { lists: LinkedInList[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-[13px] font-semibold text-white hover:text-[#AEAEB2] transition">
        <Tag size={13} /> Add to List <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-[#E5E5EA] py-1 min-w-[180px] z-50">
          {lists.length === 0
            ? <p className="px-4 py-3 text-[12px] text-[#AEAEB2] italic">No lists yet</p>
            : lists.map(l => (
              <button key={l.id} onClick={() => { onSelect(l.id); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] transition">
                {l.name} <span className="text-[#AEAEB2] text-[11px]">({l.contact_count})</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

// ── AddContactModal ───────────────────────────────────────────────────────────
interface AddContactForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  company_name: string
  job_title: string
  linkedin_url: string
  lead_source: string
  city: string
  state: string
  country: string
  notes: string
}

function AddContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Contact) => void }) {
  const [form, setForm] = useState<AddContactForm>({
    first_name: '', last_name: '', email: '', phone: '',
    company_name: '', job_title: '', linkedin_url: '', lead_source: '',
    city: '', state: '', country: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof AddContactForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/telecaller/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          company_name: form.company_name.trim() || null,
          job_title: form.job_title.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          lead_source: form.lead_source.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          country: form.country.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to create contact.'); setSaving(false); return }
      const d = await res.json()
      onCreated(d.contact ?? d)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E5EA] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#DC2626] flex items-center justify-center">
              <UserPlus size={13} className="text-white" />
            </div>
            <h2 className="text-[16px] font-bold text-[#1D1D1F]">Add Contact</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition">
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-100 text-[#FF3B30] text-[13px] rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                First Name <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="Jane"
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Last Name</label>
              <input
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Smith"
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Phone</label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Company</label>
              <input
                value={form.company_name}
                onChange={e => set('company_name', e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Job Title</label>
              <input
                value={form.job_title}
                onChange={e => set('job_title', e.target.value)}
                placeholder="VP of Sales"
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">LinkedIn URL</label>
            <input
              value={form.linkedin_url}
              onChange={e => set('linkedin_url', e.target.value)}
              placeholder="https://linkedin.com/in/janesmith"
              className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Lead Source</label>
            <input
              value={form.lead_source}
              onChange={e => set('lead_source', e.target.value)}
              placeholder="LinkedIn, Referral, Website…"
              className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Country</label>
              <select
                value={form.country}
                onChange={e => { set('country', e.target.value); set('state', '') }}
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-white"
              >
                <option value="">Select country…</option>
                {GEO_COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">State / Region</label>
              <select
                value={form.state}
                onChange={e => set('state', e.target.value)}
                disabled={!form.country}
                className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-white disabled:opacity-50"
              >
                <option value="">{form.country ? 'Select state…' : 'Select country first'}</option>
                {getStatesForCountry(form.country).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">City</label>
            <input
              value={form.city}
              onChange={e => set('city', e.target.value)}
              placeholder="e.g. New York"
              className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any notes about this contact…"
              rows={3}
              className="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl text-[13px] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F2F2F7]">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold text-[#6E6E73] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-xl transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] transition disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            {saving ? 'Adding…' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ContactAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const palette = ['#DC2626', '#2563EB', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#D97706']
  const color = palette[(name.charCodeAt(0) || 0) % palette.length]
  return (
    <div style={{ backgroundColor: color }}
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 select-none">
      {initials}
    </div>
  )
}

interface DropFilterOption { value: string; label: string; count?: number }
function DropFilter({ label, value, options, onChange }: {
  label: string; value: string; options: DropFilterOption[]; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = value !== ''
  const activeLabel = options.find(o => o.value === value)?.label
  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
      <button onClick={() => setOpen(o => !o)}
        className={`relative z-20 flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border transition whitespace-nowrap
          ${active ? 'border-[#DC2626] text-[#DC2626] bg-red-50' : 'border-[#E5E5EA] text-[#6E6E73] bg-white hover:border-[#D1D1D6] hover:text-[#1D1D1F]'}`}>
        {active ? <><span className="opacity-60">{label}:</span> <span className="font-semibold">{activeLabel}</span></> : label}
        {active
          ? <X size={10} className="ml-0.5 shrink-0" onClick={e => { e.stopPropagation(); onChange('') }} />
          : <ChevronDown size={10} className="shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 bg-white rounded-xl shadow-xl border border-[#E5E5EA] py-1.5 min-w-[180px] z-20">
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3.5 py-2 text-[12px] flex items-center justify-between hover:bg-[#F5F5F7] transition
                ${value === o.value ? 'text-[#DC2626] font-semibold' : 'text-[#1D1D1F]'}`}>
              <span>{o.label}</span>
              {o.count !== undefined && <span className="text-[11px] text-[#AEAEB2] ml-3">{o.count.toLocaleString()}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PageNav({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages: (number | -1)[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else if (page <= 4) {
    pages.push(1, 2, 3, 4, 5, -1, totalPages)
  } else if (page >= totalPages - 3) {
    pages.push(1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
  } else {
    pages.push(1, -1, page - 1, page, page + 1, -1, totalPages)
  }
  const btn = 'w-8 h-8 rounded-lg text-[12px] font-medium transition flex items-center justify-center'
  return (
    <div className="flex items-center gap-0.5">
      <button disabled={page === 1} onClick={() => onPage(page - 1)}
        className={`${btn} text-[#6E6E73] hover:bg-[#F5F5F7] disabled:opacity-30`}>
        <ChevronLeft size={13} />
      </button>
      {pages.map((p, i) => p === -1
        ? <span key={`e${i}`} className={`${btn} text-[#AEAEB2] cursor-default`}>…</span>
        : <button key={p} onClick={() => onPage(p)}
            className={`${btn} ${page === p ? 'bg-[#DC2626] text-white' : 'text-[#6E6E73] hover:bg-[#F5F5F7]'}`}>{p}</button>
      )}
      <button disabled={page === totalPages} onClick={() => onPage(page + 1)}
        className={`${btn} text-[#6E6E73] hover:bg-[#F5F5F7] disabled:opacity-30`}>
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<Stats>({ totalAssigned: 0, totalSent: 0, totalPending: 0 })
  const [pipeline, setPipeline] = useState<Pipeline>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterList, setFilterList] = useState('')
  const [filterPipeline, setFilterPipeline] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lists, setLists] = useState<LinkedInList[]>([])
  const [showListsPanel, setShowListsPanel] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)

  const load = useCallback(async (p = 1, s = search, st = filterStatus, fl = filterList, fp = filterPipeline) => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p) })
    if (s) q.set('search', s)
    if (st) q.set('status', st)
    if (fl) q.set('list_id', fl)
    if (fp) q.set('pipeline_status', fp)
    const res = await fetch(`/api/telecaller/contacts?${q}`)
    const d = await res.json()
    setContacts(d.contacts ?? [])
    setTotal(d.total ?? 0)
    setStats(d.stats ?? { totalAssigned: 0, totalSent: 0, totalPending: 0 })
    setPipeline(d.pipeline ?? {})
    setPage(p)
    setLoading(false)
  }, [search, filterStatus, filterList, filterPipeline])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/linkedin/lists').then(r => r.json()).then(d => setLists(d.lists ?? []))
  }, [])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => load(1, search, filterStatus, filterList, filterPipeline), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Select all logic
  const allPageIds = contacts.map(c => c.id)
  const allSelected = allPageIds.length > 0 && allPageIds.every(id => selected.has(id))
  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) allPageIds.forEach(id => next.delete(id))
      else allPageIds.forEach(id => next.add(id))
      return next
    })
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Bulk handlers
  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} contact(s)?`)) return
    await fetch('/api/telecaller/contacts', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: [...selected] }),
    })
    setSelected(new Set()); load()
  }
  async function addToList(listId: string) {
    await fetch(`/api/linkedin/lists/${listId}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: [...selected] }),
    })
    setSelected(new Set())
    fetch('/api/linkedin/lists').then(r => r.json()).then(d => setLists(d.lists ?? []))
  }
  async function removeFromList() {
    if (!filterList || filterList === 'none') return
    await fetch(`/api/linkedin/lists/${filterList}/contacts`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: [...selected] }),
    })
    setSelected(new Set()); load()
  }

  function handleContactCreated(c: Contact) {
    setContacts(prev => [c, ...prev])
    setTotal(prev => prev + 1)
    setStats(prev => ({ ...prev, totalAssigned: prev.totalAssigned + 1, totalPending: prev.totalPending + 1 }))
    setShowAddContact(false)
  }

  const pipelineFilterOptions: DropFilterOption[] = PIPELINE_STAGES.map(s => ({
    value: s.value, label: s.label, count: pipeline[s.value as keyof Pipeline] ?? 0
  }))
  const listFilterOptions: DropFilterOption[] = [
    { value: 'none', label: 'No list assigned' },
    ...lists.map(l => ({ value: l.id, label: l.name, count: l.contact_count })),
  ]
  const listTabs = [{ id: '', name: 'All Contacts', contact_count: stats.totalAssigned }, ...lists]
  const hasFilters = !!(search || filterStatus || filterPipeline || filterList)

  return (
    <>
      {showListsPanel && (
        <ListsModal
          onClose={() => setShowListsPanel(false)}
          onListsChanged={() => fetch('/api/linkedin/lists').then(r => r.json()).then(d => setLists(d.lists ?? []))}
        />
      )}
      {showAddContact && (
        <AddContactModal
          onClose={() => setShowAddContact(false)}
          onCreated={handleContactCreated}
        />
      )}
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1D1D1F] text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 whitespace-nowrap">
          <span className="text-[13px] font-semibold">{selected.size} selected</span>
          <div className="w-px h-4 bg-white/20" />
          <AddToListDropdown lists={lists} onSelect={addToList} />
          {filterList && filterList !== 'none' && (
            <button onClick={removeFromList} className="text-[13px] font-semibold text-orange-300 hover:text-orange-200 transition">Remove from list</button>
          )}
          <button onClick={handleBulkDelete} className="text-[13px] font-semibold text-red-400 hover:text-red-300 transition">Delete</button>
          <button onClick={() => setSelected(new Set())} className="text-[#AEAEB2] hover:text-white transition"><X size={14} /></button>
        </div>
      )}

      <div className="p-6 min-h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Contacts</h1>
            <p className="text-[13px] text-[#6E6E73] mt-0.5">
              {loading ? '…' : `${total.toLocaleString()} records`}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setShowListsPanel(true)}
              className="flex items-center gap-1.5 h-9 px-3.5 border border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] text-[13px] font-medium rounded-lg transition">
              <List size={14} /> Lists
            </button>
            <button onClick={() => setShowAddContact(true)}
              className="flex items-center gap-1.5 h-9 px-3.5 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-[13px] font-semibold rounded-lg transition">
              <UserPlus size={14} /> Add Contact
            </button>
          </div>
        </div>

        {/* List view tabs */}
        <div className="flex items-center border-b border-[#E5E5EA] overflow-x-auto -mx-6 px-6" style={{ scrollbarWidth: 'none' }}>
          {listTabs.map(tab => (
            <button key={tab.id || 'all'}
              onClick={() => { setFilterList(tab.id); load(1, search, filterStatus, tab.id, filterPipeline) }}
              className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition
                ${filterList === tab.id
                  ? 'border-[#DC2626] text-[#DC2626]'
                  : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F] hover:border-[#D1D1D6]'}`}>
              {tab.name}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold
                ${filterList === tab.id ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-[#F5F5F7] text-[#6E6E73]'}`}>
                {(tab.contact_count ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        {/* Filter + search bar */}
        <div className="flex items-center gap-2 py-3 border-b border-[#F2F2F7] -mx-6 px-6">
          <DropFilter label="Pipeline" value={filterPipeline} options={pipelineFilterOptions}
            onChange={v => { setFilterPipeline(v); load(1, search, filterStatus, filterList, v) }} />
          <DropFilter label="List" value={filterList && filterList !== '' ? filterList : ''}
            options={listFilterOptions}
            onChange={v => { setFilterList(v); load(1, search, filterStatus, v, filterPipeline) }} />
          <div className="flex-1" />
          {contacts.length > 0 && (
            <button onClick={() => exportContactsCSV(contacts)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] rounded-lg hover:border-[#D1D1D6] transition">
              <Download size={12} /> Export
            </button>
          )}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="pl-8 pr-3 h-8 border border-[#E5E5EA] rounded-lg text-[12px] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/10 transition bg-white w-52" />
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPipeline(''); setFilterList(''); load(1,'','','','') }}
              className="h-8 px-3 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-lg hover:border-[#D1D1D6] transition flex items-center gap-1 whitespace-nowrap">
              <X size={10} /> Clear all
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E5E5EA] overflow-hidden mt-3 rounded-xl">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin text-[#DC2626]" /></div>
          ) : contacts.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mx-auto mb-3">
                <Users size={20} className="text-[#AEAEB2]" />
              </div>
              <p className="text-[13px] font-semibold text-[#1D1D1F]">
                {stats.totalAssigned === 0 ? 'No contacts yet' : 'No contacts match your filters'}
              </p>
              <p className="text-[12px] text-[#AEAEB2] mt-1">
                {stats.totalAssigned === 0
                  ? 'Add a contact or ask your manager to assign contacts to you.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
              {stats.totalAssigned === 0 && (
                <button onClick={() => setShowAddContact(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition">
                  <UserPlus size={13} /> Add Contact
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="w-3.5 h-3.5 rounded border-[#D1D1D6] text-[#DC2626] cursor-pointer" />
                    </th>
                    {['Name', 'Company', 'Pipeline Stage', 'Location', 'Lead Source', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => {
                    const pStyle = getPipelineStyle(c.pipeline_status)
                    return (
                      <tr key={c.id} className="border-b border-[#F2F2F7] hover:bg-[#FAFAFA] transition group last:border-b-0">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)}
                            className="w-3.5 h-3.5 rounded border-[#D1D1D6] text-[#DC2626] cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <ContactAvatar name={`${c.first_name} ${c.last_name ?? ''}`} />
                            <div>
                              <button onClick={() => router.push(`/telecaller/contacts/${c.id}`)}
                                className="text-[13px] font-semibold text-[#1D1D1F] hover:text-[#DC2626] transition text-left leading-tight">
                                {c.first_name} {c.last_name ?? ''}
                              </button>
                              {c.email && <p className="text-[11px] text-[#AEAEB2] mt-0.5">{c.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-[13px] text-[#1D1D1F]">{c.company_name ?? '—'}</p>
                            {c.job_title && <p className="text-[11px] text-[#AEAEB2] mt-0.5">{c.job_title}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {c.pipeline_status
                            ? <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
                                {pStyle.label}
                              </span>
                            : <span className="text-[#AEAEB2] text-[13px]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#6E6E73] whitespace-nowrap">
                          {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.lead_source
                            ? <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-semibold rounded-md border border-blue-100">{c.lead_source}</span>
                            : <span className="text-[#AEAEB2] text-[13px]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6E6E73] whitespace-nowrap">
                          {fmtDate(c.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => router.push(`/telecaller/contacts/${c.id}`)}
                              className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition">
                              <Search size={13} />
                            </button>
                            <button onClick={() => {
                                if (confirm('Delete this contact?')) {
                                  fetch(`/api/telecaller/contacts/${c.id}`, { method: 'DELETE' })
                                    .then(() => setContacts(prev => prev.filter(x => x.id !== c.id)))
                                }
                              }}
                              className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#FF3B30] hover:bg-red-50 transition">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#F2F2F7]">
              <p className="text-[12px] text-[#AEAEB2]">
                Showing {Math.min((page - 1) * pageSize + 1, total).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}
              </p>
              {totalPages > 1 && <PageNav page={page} totalPages={totalPages} onPage={p => load(p)} />}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
