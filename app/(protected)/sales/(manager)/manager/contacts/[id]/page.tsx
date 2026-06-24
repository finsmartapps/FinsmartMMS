'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Pencil, Save, X, Loader2,
  Calendar, PhoneCall, MessageSquare, ExternalLink,
  CheckCircle2, Clock, AlertCircle, Building2, MapPin,
  RotateCcw, ChevronRight, User, Briefcase,
  RefreshCw, Copy, Check, Search, Trash2,
} from 'lucide-react'
import { GEO_COUNTRIES, getStatesForCountry } from '@/lib/geo'

// ── Types ────────────────────────────────────────────────────────
interface Contact {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  job_title: string | null
  linkedin_url: string | null
  lead_source: string | null
  city: string | null
  state: string | null
  country: string | null
  notes: string | null
  pipeline_status: 'new' | 'contacted' | 'interested' | 'won' | 'lost' | null
  status: 'queued' | 'request_sent'
  generated_message: string | null
  created_at: string
  assigned_to_name?: string | null
}

interface FollowUp {
  id: string
  follow_up_date: string
  notes: string | null
  status: 'pending' | 'completed'
  created_at: string
}

interface Meeting {
  id: string
  meeting_date: string
  meeting_time: string
  timezone: string
  notes: string | null
  outcome: string | null
  company_name: string | null
  lead_source: string | null
  created_at: string
}

interface ActivityEntry {
  id: string
  action: string
  detail: string | null
  created_at: string
  profiles: { name: string } | null
}

interface ContactCall {
  id: string
  call_date: string
  call_time: string | null
  duration_mins: number | null
  outcome: 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'left_message' | null
  notes: string | null
  created_at: string
}

interface ContactTask {
  id: string
  title: string
  due_date: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'completed'
  notes: string | null
  created_at: string
  completed_at: string | null
}

// ── Constants ────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { value: 'new',        label: 'New',        color: '#6E6E73', bg: '#F5F5F7',  dot: '#AEAEB2' },
  { value: 'contacted',  label: 'Contacted',  color: '#2563EB', bg: '#EFF6FF',  dot: '#2563EB' },
  { value: 'interested', label: 'Interested', color: '#EA580C', bg: '#FFF7ED',  dot: '#EA580C' },
  { value: 'won',        label: 'Won',        color: '#16A34A', bg: '#F0FDF4',  dot: '#16A34A' },
  { value: 'lost',       label: 'Lost',       color: '#DC2626', bg: '#FEF2F2',  dot: '#DC2626' },
]

// ── Helpers ──────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function LinkedInIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function ContactAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const palette = ['#DC2626', '#2563EB', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#D97706']
  const color = palette[(name.charCodeAt(0) || 0) % palette.length]
  const cls = size === 'lg' ? 'w-14 h-14 text-[18px]' : 'w-8 h-8 text-[11px]'
  return (
    <div style={{ backgroundColor: color }}
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none`}>
      {initials}
    </div>
  )
}

function PipelineBadge({ stage }: { stage: string | null }) {
  const s = PIPELINE_STAGES.find(p => p.value === stage) ?? PIPELINE_STAGES[0]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  )
}

function ActivityIcon({ action }: { action: string }) {
  if (action === 'callback') return <PhoneCall size={13} className="text-blue-500" />
  if (action === 'meeting') return <Calendar size={13} className="text-purple-500" />
  if (action === 'stage_changed') return <RefreshCw size={13} className="text-orange-500" />
  if (action === 'note_added') return <MessageSquare size={13} className="text-[#AEAEB2]" />
  if (action === 'message_generated') return <MessageSquare size={13} className="text-blue-400" />
  return <RotateCcw size={13} className="text-[#AEAEB2]" />
}

// ── Page ────────────────────────────────────────────────────────
export default function ManagerContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [contact, setContact] = useState<Contact | null>(null)
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'intelligence'>('overview')
  const [activitySub, setActivitySub] = useState<'all' | 'callbacks' | 'meetings' | 'notes' | 'tasks'>('all')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Contact>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [activitySearch, setActivitySearch] = useState('')
  const [calls, setCalls] = useState<ContactCall[]>([])
  const [tasks, setTasks] = useState<ContactTask[]>([])
  const [activeAction, setActiveAction] = useState<'note' | 'call' | 'task' | null>(null)

  // Note form
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Call form
  const [callForm, setCallForm] = useState({ call_date: '', call_time: '', duration_mins: '', outcome: '', notes: '' })
  const [savingCall, setSavingCall] = useState(false)

  // Task form
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', priority: 'medium', notes: '' })
  const [savingTask, setSavingTask] = useState(false)

  const loadContact = useCallback(async () => {
    const res = await fetch(`/api/manager/contacts/${id}`)
    const d = await res.json()
    if (!res.ok) { router.push('/sales/manager/contacts'); return }
    setContact(d.contact)
    setEditForm(d.contact)
    setLoading(false)
  }, [id, router])

  const loadTimeline = useCallback(async () => {
    const res = await fetch(`/api/manager/contacts/${id}/timeline`)
    const d = await res.json()
    if (res.ok) {
      setFollowups(d.followups ?? [])
      setMeetings(d.meetings ?? [])
      setActivity(d.activity ?? [])
      setCalls(d.calls ?? [])
      setTasks(d.tasks ?? [])
    }
  }, [id])

  useEffect(() => { loadContact(); loadTimeline() }, [loadContact, loadTimeline])

  async function handleSave() {
    if (!editForm.first_name?.trim()) { setSaveError('First name is required.'); return }
    setSaving(true); setSaveError('')
    const res = await fetch(`/api/manager/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const d = await res.json()
    if (!res.ok) { setSaveError(d.error ?? 'Save failed.'); setSaving(false); return }
    setContact(d.contact)
    setEditForm(d.contact)
    setEditing(false)
    setSaving(false)
    loadTimeline()
  }

  async function handleStageChange(stage: string) {
    const res = await fetch(`/api/manager/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_status: stage }),
    })
    const d = await res.json()
    if (res.ok) { setContact(c => c ? { ...c, pipeline_status: d.contact.pipeline_status } : c); loadTimeline() }
  }

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    const res = await fetch(`/api/manager/contacts/${id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText }),
    })
    if (res.ok) { setNoteText(''); setActiveAction(null); loadTimeline() }
    setSavingNote(false)
  }

  async function handleSaveCall() {
    setSavingCall(true)
    const res = await fetch(`/api/manager/contacts/${id}/calls`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...callForm, duration_mins: callForm.duration_mins ? Number(callForm.duration_mins) : null }),
    })
    if (res.ok) {
      setCalls([])  // will reload
      setCallForm({ call_date: '', call_time: '', duration_mins: '', outcome: '', notes: '' })
      setActiveAction(null)
      loadTimeline()
    }
    setSavingCall(false)
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim()) return
    setSavingTask(true)
    const res = await fetch(`/api/manager/contacts/${id}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskForm),
    })
    if (res.ok) {
      const d = await res.json()
      setTasks(prev => [d.task, ...prev])
      setTaskForm({ title: '', due_date: '', priority: 'medium', notes: '' })
      setActiveAction(null)
      loadTimeline()
    }
    setSavingTask(false)
  }

  async function handleToggleTask(taskId: string, current: 'pending' | 'completed') {
    const newStatus = current === 'completed' ? 'pending' : 'completed'
    const res = await fetch(`/api/manager/contacts/${id}/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const d = await res.json()
      setTasks(prev => prev.map(t => t.id === taskId ? d.task : t))
      loadTimeline()
    }
  }

  async function handleDeleteCall(callId: string) {
    await fetch(`/api/manager/contacts/${id}/calls/${callId}`, { method: 'DELETE' })
    setCalls(prev => prev.filter(c => c.id !== callId))
  }

  async function handleDeleteTask(taskId: string) {
    await fetch(`/api/manager/contacts/${id}/tasks/${taskId}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#DC2626]" />
      </div>
    )
  }

  if (!contact) return null

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.value === contact.pipeline_status)
  const upcomingCallbacks = followups.filter(f => f.status === 'pending' && new Date(f.follow_up_date) >= new Date())
  const upcomingMeetings = meetings.filter(m => !m.outcome && new Date(m.meeting_date) >= new Date())

  // Build combined timeline
  const allItems = [
    ...followups.map(f => ({ type: 'callback' as const, date: f.follow_up_date, data: f })),
    ...meetings.map(m => ({ type: 'meeting' as const, date: m.meeting_date, data: m })),
    ...activity.map(a => ({ type: 'activity' as const, date: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filteredItems = activitySub === 'all' ? allItems
    : activitySub === 'callbacks' ? allItems.filter(i => i.type === 'callback')
    : activitySub === 'meetings' ? allItems.filter(i => i.type === 'meeting')
    : activitySub === 'tasks' ? []
    : allItems.filter(i => i.type === 'activity' && ((i.data as ActivityEntry).action === 'note_added'))

  const searchFiltered = activitySearch.trim()
    ? filteredItems.filter(item => {
        const q = activitySearch.toLowerCase()
        if (item.type === 'callback') return (item.data as FollowUp).notes?.toLowerCase().includes(q) ?? false
        if (item.type === 'meeting') {
          const m = item.data as Meeting
          return (m.notes?.toLowerCase().includes(q) || m.company_name?.toLowerCase().includes(q)) ?? false
        }
        return (item.data as ActivityEntry).detail?.toLowerCase().includes(q) ?? false
      })
    : filteredItems

  // Group by month
  function groupByMonth(items: typeof allItems) {
    const groups: Record<string, typeof allItems> = {}
    items.forEach(item => {
      const d = new Date(item.date)
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })
    return groups
  }

  const inputCls = 'w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/10 transition bg-white'
  const labelCls = 'text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block'

  return (
    <div className="flex h-full min-h-0" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-[#E5E5EA] bg-white overflow-y-auto flex flex-col">
        {/* Back nav */}
        <div className="px-4 py-3 border-b border-[#F2F2F7] flex items-center justify-between flex-shrink-0">
          <Link href="/sales/manager/contacts"
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] hover:text-[#DC2626] transition">
            <ArrowLeft size={13} /> Contacts
          </Link>
          {editing
            ? <div className="flex items-center gap-1.5">
                <button onClick={() => { setEditing(false); setEditForm(contact); setSaveError('') }}
                  className="text-[11px] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-lg px-2.5 py-1 transition">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 text-[11px] bg-[#DC2626] text-white rounded-lg px-2.5 py-1 hover:bg-[#C91C1C] transition disabled:opacity-50">
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
                </button>
              </div>
            : <button onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-[11px] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-lg px-2.5 py-1.5 transition hover:border-[#D1D1D6]">
                <Pencil size={11} /> Edit
              </button>
          }
        </div>

        {/* Contact header */}
        <div className="px-4 py-4 border-b border-[#F2F2F7] flex-shrink-0">
          <div className="flex items-start gap-3 mb-3">
            <ContactAvatar name={fullName} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-bold text-[#1D1D1F] leading-tight truncate">{fullName}</h2>
              {(contact.job_title || contact.company_name) && (
                <p className="text-[12px] text-[#6E6E73] mt-0.5 truncate">
                  {[contact.job_title, contact.company_name].filter(Boolean).join(' at ')}
                </p>
              )}
              <div className="mt-2">
                <PipelineBadge stage={contact.pipeline_status} />
              </div>
            </div>
          </div>

          {contact.email && (
            <a href={`mailto:${contact.email}`}
              className="flex items-center gap-2 text-[12px] text-[#DC2626] hover:underline mb-1 truncate">
              <Mail size={12} className="flex-shrink-0" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`}
              className="flex items-center gap-2 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] transition mb-1">
              <Phone size={12} className="flex-shrink-0" /> {contact.phone}
            </a>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-4 py-3 border-b border-[#F2F2F7] flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {contact.phone && (
              <a href={`tel:${contact.phone}`}
                className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className="w-9 h-9 rounded-full border border-[#E5E5EA] flex items-center justify-center group-hover:border-[#DC2626] group-hover:bg-red-50 transition">
                  <Phone size={14} className="text-[#6E6E73] group-hover:text-[#DC2626]" />
                </div>
                <span className="text-[10px] text-[#AEAEB2]">Call</span>
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`}
                className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className="w-9 h-9 rounded-full border border-[#E5E5EA] flex items-center justify-center group-hover:border-[#DC2626] group-hover:bg-red-50 transition">
                  <Mail size={14} className="text-[#6E6E73] group-hover:text-[#DC2626]" />
                </div>
                <span className="text-[10px] text-[#AEAEB2]">Email</span>
              </a>
            )}
            <Link href={`/sales/manager/followups?contact=${id}`}
              className="flex flex-col items-center gap-1 group cursor-pointer">
              <div className="w-9 h-9 rounded-full border border-[#E5E5EA] flex items-center justify-center group-hover:border-[#DC2626] group-hover:bg-red-50 transition">
                <PhoneCall size={14} className="text-[#6E6E73] group-hover:text-[#DC2626]" />
              </div>
              <span className="text-[10px] text-[#AEAEB2]">Callback</span>
            </Link>
            <Link href={`/sales/manager/meetings?contact=${id}`}
              className="flex flex-col items-center gap-1 group cursor-pointer">
              <div className="w-9 h-9 rounded-full border border-[#E5E5EA] flex items-center justify-center group-hover:border-[#DC2626] group-hover:bg-red-50 transition">
                <Calendar size={14} className="text-[#6E6E73] group-hover:text-[#DC2626]" />
              </div>
              <span className="text-[10px] text-[#AEAEB2]">Meeting</span>
            </Link>
            {contact.linkedin_url && (
              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className="w-9 h-9 rounded-full border border-[#E5E5EA] flex items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-50 transition">
                  <LinkedInIcon size={14} className="text-[#6E6E73] group-hover:text-blue-600" />
                </div>
                <span className="text-[10px] text-[#AEAEB2]">LinkedIn</span>
              </a>
            )}
          </div>
        </div>

        {/* About section */}
        <div className="px-4 py-4 flex-1">
          <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-3">About this contact</p>
          {saveError && <p className="text-[11px] text-[#DC2626] bg-red-50 rounded-lg px-3 py-2 mb-3 border border-red-100">{saveError}</p>}

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <input value={editForm.first_name ?? ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input value={editForm.last_name ?? ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <input value={editForm.company_name ?? ''} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Job Title</label>
                <input value={editForm.job_title ?? ''} onChange={e => setEditForm(f => ({ ...f, job_title: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>LinkedIn URL</label>
                <input value={editForm.linkedin_url ?? ''} onChange={e => setEditForm(f => ({ ...f, linkedin_url: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Lead Source</label>
                <input value={editForm.lead_source ?? ''} onChange={e => setEditForm(f => ({ ...f, lead_source: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select value={editForm.country ?? ''} onChange={e => setEditForm(f => ({ ...f, country: e.target.value, state: '' }))} className={inputCls}>
                  <option value="">Select country…</option>
                  {GEO_COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>State / Region</label>
                <select value={editForm.state ?? ''} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} className={inputCls} disabled={!editForm.country}>
                  <option value="">{editForm.country ? 'Select state…' : 'Select country first'}</option>
                  {getStatesForCountry(editForm.country ?? '').map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input value={editForm.city ?? ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} className={inputCls} placeholder="e.g. New York" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Pipeline Stage', value: <PipelineBadge stage={contact.pipeline_status} /> },
                { label: 'Assigned To', value: contact.assigned_to_name ?? null },
                { label: 'First Name', value: contact.first_name },
                { label: 'Last Name', value: contact.last_name },
                { label: 'Email', value: contact.email },
                { label: 'Phone', value: contact.phone },
                { label: 'Company', value: contact.company_name },
                { label: 'Job Title', value: contact.job_title },
                { label: 'Lead Source', value: contact.lead_source },
                { label: 'Location', value: [contact.city, contact.state, contact.country].filter(Boolean).join(', ') || null },
                { label: 'LinkedIn', value: contact.linkedin_url ? <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-[12px]">View profile <ExternalLink size={10} /></a> : null },
                { label: 'Notes', value: contact.notes },
                { label: 'Created', value: fmtDate(contact.created_at) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider">{label}</p>
                  <div className="text-[13px] text-[#1D1D1F] mt-0.5">
                    {value ?? <span className="text-[#AEAEB2]">—</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 bg-[#FAFAFA] overflow-y-auto">
        {/* Tab bar */}
        <div className="bg-white border-b border-[#E5E5EA] px-6 flex items-center sticky top-0 z-10">
          {(['overview', 'activities', 'intelligence'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-4 text-[13px] font-medium capitalize border-b-2 -mb-px transition
                ${activeTab === tab ? 'border-[#DC2626] text-[#DC2626]' : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F] hover:border-[#D1D1D6]'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === 'overview' && (
  <div className="max-w-3xl space-y-4">
    {/* Key properties strip — HubSpot style */}
    <div className="bg-white border border-[#E5E5EA] rounded-xl px-5 py-3.5">
      <div className="flex items-center flex-wrap gap-0">
        {[
          { label: 'Pipeline Stage', value: <PipelineBadge stage={contact.pipeline_status} /> },
          { label: 'Company', value: contact.company_name },
          { label: 'Role', value: contact.job_title },
          { label: 'City', value: contact.city },
          { label: 'State', value: contact.state },
          { label: 'Country', value: contact.country },
        ].filter(f => f.value).map(({ label, value }, i) => (
          <div key={label} className={`flex flex-col py-1 ${i > 0 ? 'pl-5 ml-5 border-l border-[#F2F2F7]' : ''}`}>
            <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider">{label}</p>
            <div className="text-[13px] font-medium text-[#1D1D1F] mt-0.5">{value}</div>
          </div>
        ))}
      </div>
    </div>

    {/* 2-col: About + Contact Outreach */}
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-5">
        <p className="text-[13px] font-semibold text-[#1D1D1F] mb-4">About</p>
        <div className="space-y-3">
          {contact.lead_source && (
            <div>
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Lead Source</p>
              <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-semibold rounded-md border border-blue-100">{contact.lead_source}</span>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Created</p>
            <p className="text-[13px] text-[#1D1D1F]">{fmtDate(contact.created_at)}</p>
          </div>
          {activity[0] && (
            <div>
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Last Activity</p>
              <p className="text-[13px] text-[#1D1D1F]">{relTime(activity[0].created_at)}</p>
            </div>
          )}
          {contact.notes && (
            <div>
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Notes</p>
              <p className="text-[13px] text-[#1D1D1F] leading-relaxed">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5EA] p-5">
        <p className="text-[13px] font-semibold text-[#1D1D1F] mb-4">Contact Outreach</p>
        <div className="space-y-3">
          {contact.email && (
            <div>
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Email</p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#1D1D1F] truncate">{contact.email}</span>
                <button onClick={() => copyToClipboard(contact.email!, 'email')} className="text-[#AEAEB2] hover:text-[#1D1D1F] flex-shrink-0">
                  {copied === 'email' ? <Check size={12} className="text-[#34C759]" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}
          {contact.phone && (
            <div>
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Phone</p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#1D1D1F]">{contact.phone}</span>
                <button onClick={() => copyToClipboard(contact.phone!, 'phone')} className="text-[#AEAEB2] hover:text-[#1D1D1F] flex-shrink-0">
                  {copied === 'phone' ? <Check size={12} className="text-[#34C759]" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}
          {contact.linkedin_url && (
            <div>
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">LinkedIn</p>
              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-blue-500 hover:underline">
                View profile <ExternalLink size={11} />
              </a>
            </div>
          )}
          {!contact.email && !contact.phone && !contact.linkedin_url && (
            <p className="text-[12px] text-[#AEAEB2]">No outreach info available</p>
          )}
        </div>
      </div>
    </div>

    {/* Upcoming activities */}
    <div className="bg-white rounded-xl border border-[#E5E5EA]">
      <div className="px-5 py-3.5 border-b border-[#F2F2F7] flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#1D1D1F]">Upcoming Activities</p>
        <span className="text-[11px] text-[#AEAEB2]">{upcomingCallbacks.length + upcomingMeetings.length} upcoming</span>
      </div>
      {upcomingCallbacks.length === 0 && upcomingMeetings.length === 0 ? (
        <div className="py-10 text-center">
          <Clock size={18} className="text-[#AEAEB2] mx-auto mb-2" />
          <p className="text-[12px] text-[#AEAEB2]">No upcoming activities</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F2F2F7]">
          {upcomingCallbacks.slice(0, 3).map(f => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <PhoneCall size={12} className="text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1D1D1F]">Callback</p>
                {f.notes && <p className="text-[11px] text-[#6E6E73] truncate">{f.notes}</p>}
              </div>
              <span className="text-[11px] text-[#AEAEB2] flex-shrink-0">{fmtDate(f.follow_up_date)}</span>
            </div>
          ))}
          {upcomingMeetings.slice(0, 3).map(m => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Calendar size={12} className="text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1D1D1F]">Meeting{m.meeting_time ? ` at ${m.meeting_time}` : ''}</p>
                {m.company_name && <p className="text-[11px] text-[#6E6E73] truncate">{m.company_name}</p>}
              </div>
              <span className="text-[11px] text-[#AEAEB2] flex-shrink-0">{fmtDate(m.meeting_date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}

          {/* ─── ACTIVITIES TAB ─── */}
          {activeTab === 'activities' && (
  <div className="max-w-3xl">
    {/* Action buttons — Note, Call, Task, Meeting */}
    <div className="flex items-center gap-2 mb-4">
      {[
        { key: 'note' as const, label: 'Note', icon: <MessageSquare size={13} /> },
        { key: 'call' as const, label: 'Log a call', icon: <PhoneCall size={13} /> },
        { key: 'task' as const, label: 'Create task', icon: <CheckCircle2 size={13} /> },
      ].map(btn => (
        <button key={btn.key}
          onClick={() => setActiveAction(activeAction === btn.key ? null : btn.key)}
          className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border transition
            ${activeAction === btn.key
              ? 'bg-[#DC2626] text-white border-[#DC2626]'
              : 'border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] hover:border-[#D1D1D6] bg-white'}`}>
          {btn.icon} {btn.label}
        </button>
      ))}
    </div>

    {/* Inline forms */}
    {activeAction === 'note' && (
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-4 mb-4">
        <p className="text-[12px] font-semibold text-[#1D1D1F] mb-2">Add Note</p>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Write a note about this contact…"
          rows={3}
          className="w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#DC2626] resize-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <button onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}
            className="flex items-center gap-1.5 h-7 px-3 bg-[#DC2626] text-white text-[12px] font-medium rounded-lg hover:bg-[#C91C1C] disabled:opacity-50 transition">
            {savingNote ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save note
          </button>
          <button onClick={() => { setActiveAction(null); setNoteText('') }}
            className="h-7 px-3 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-lg transition">
            Cancel
          </button>
        </div>
      </div>
    )}

    {activeAction === 'call' && (
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-4 mb-4">
        <p className="text-[12px] font-semibold text-[#1D1D1F] mb-3">Log a Call</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Date</label>
            <input type="date" value={callForm.call_date} onChange={e => setCallForm(f => ({ ...f, call_date: e.target.value }))}
              className="w-full border border-[#E5E5EA] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#DC2626]" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Duration (mins)</label>
            <input type="number" min="0" value={callForm.duration_mins} onChange={e => setCallForm(f => ({ ...f, duration_mins: e.target.value }))}
              placeholder="e.g. 5"
              className="w-full border border-[#E5E5EA] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#DC2626]" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Outcome</label>
            <select value={callForm.outcome} onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value }))}
              className="w-full border border-[#E5E5EA] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#DC2626] bg-white">
              <option value="">Select outcome…</option>
              <option value="connected">Connected</option>
              <option value="no_answer">No Answer</option>
              <option value="busy">Busy</option>
              <option value="voicemail">Voicemail</option>
              <option value="left_message">Left Message</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Time (optional)</label>
            <input type="time" value={callForm.call_time} onChange={e => setCallForm(f => ({ ...f, call_time: e.target.value }))}
              className="w-full border border-[#E5E5EA] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#DC2626]" />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Notes</label>
          <textarea value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="What was discussed…" rows={2}
            className="w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#DC2626] resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSaveCall} disabled={savingCall}
            className="flex items-center gap-1.5 h-7 px-3 bg-[#DC2626] text-white text-[12px] font-medium rounded-lg hover:bg-[#C91C1C] disabled:opacity-50 transition">
            {savingCall ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Log call
          </button>
          <button onClick={() => setActiveAction(null)}
            className="h-7 px-3 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-lg transition">
            Cancel
          </button>
        </div>
      </div>
    )}

    {activeAction === 'task' && (
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-4 mb-4">
        <p className="text-[12px] font-semibold text-[#1D1D1F] mb-3">Create Task</p>
        <div className="mb-3">
          <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Task Title *</label>
          <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Send proposal, Follow up on email…"
            className="w-full border border-[#E5E5EA] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#DC2626]" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Due Date</label>
            <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full border border-[#E5E5EA] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#DC2626]" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Priority</label>
            <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
              className="w-full border border-[#E5E5EA] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#DC2626] bg-white">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block">Notes</label>
          <textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Additional details…" rows={2}
            className="w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#DC2626] resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSaveTask} disabled={savingTask || !taskForm.title.trim()}
            className="flex items-center gap-1.5 h-7 px-3 bg-[#DC2626] text-white text-[12px] font-medium rounded-lg hover:bg-[#C91C1C] disabled:opacity-50 transition">
            {savingTask ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Create task
          </button>
          <button onClick={() => setActiveAction(null)}
            className="h-7 px-3 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-lg transition">
            Cancel
          </button>
        </div>
      </div>
    )}

    {/* Search + filter */}
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1 max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] pointer-events-none" />
        <input value={activitySearch} onChange={e => setActivitySearch(e.target.value)}
          placeholder="Search activities…"
          className="w-full pl-8 pr-3 h-8 border border-[#E5E5EA] rounded-lg text-[12px] focus:outline-none focus:border-[#DC2626] bg-white text-[#1D1D1F]" />
      </div>
      {activitySearch && (
        <button onClick={() => setActivitySearch('')} className="text-[11px] text-[#AEAEB2] hover:text-[#1D1D1F] flex items-center gap-1">
          <X size={11} /> Clear
        </button>
      )}
    </div>

    {/* Sub-tabs */}
    <div className="flex items-center gap-0 mb-5 border-b border-[#E5E5EA]">
      {([
        { key: 'all', label: 'All', count: allItems.length + calls.length + tasks.length },
        { key: 'notes', label: 'Notes', count: activity.filter(a => a.action === 'note_added').length },
        { key: 'callbacks', label: 'Calls', count: calls.length + followups.length },
        { key: 'meetings', label: 'Meetings', count: meetings.length },
        { key: 'tasks', label: 'Tasks', count: tasks.length },
      ] as const).map(t => (
        <button key={t.key} onClick={() => setActivitySub(t.key as typeof activitySub)}
          className={`px-4 py-2.5 text-[12px] font-medium capitalize border-b-2 -mb-px transition
            ${activitySub === t.key ? 'border-[#DC2626] text-[#DC2626]' : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F]'}`}>
          {t.label}
          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F5F7] text-[#6E6E73]">{t.count}</span>
        </button>
      ))}
    </div>

    {/* Tasks panel (shown when sub-tab is tasks) */}
    {(activitySub === 'tasks') && (
      <div className="mb-5">
        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E5E5EA] py-10 text-center">
            <CheckCircle2 size={20} className="text-[#AEAEB2] mx-auto mb-2" />
            <p className="text-[12px] text-[#AEAEB2]">No tasks yet. Click &quot;Create task&quot; to add one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => {
              const isOverdue = t.due_date && t.status === 'pending' && new Date(t.due_date) < new Date()
              const priorityColor = t.priority === 'high' ? 'text-[#FF3B30]' : t.priority === 'medium' ? 'text-[#FF9500]' : 'text-[#34C759]'
              return (
                <div key={t.id} className="bg-white rounded-xl border border-[#E5E5EA] px-4 py-3 flex items-start gap-3">
                  <button onClick={() => handleToggleTask(t.id, t.status)} className="mt-0.5 flex-shrink-0">
                    {t.status === 'completed'
                      ? <CheckCircle2 size={16} className="text-[#34C759]" />
                      : <div className="w-4 h-4 rounded-full border-2 border-[#D1D1D6] hover:border-[#DC2626] transition" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium ${t.status === 'completed' ? 'line-through text-[#AEAEB2]' : 'text-[#1D1D1F]'}`}>{t.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {t.due_date && (
                        <span className={`text-[11px] ${isOverdue ? 'text-[#FF3B30] font-medium' : 'text-[#AEAEB2]'}`}>
                          Due {fmtDate(t.due_date)}{isOverdue ? ' · Overdue' : ''}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold uppercase ${priorityColor}`}>{t.priority}</span>
                    </div>
                    {t.notes && <p className="text-[11px] text-[#6E6E73] mt-1">{t.notes}</p>}
                  </div>
                  <button onClick={() => handleDeleteTask(t.id)} className="text-[#AEAEB2] hover:text-[#FF3B30] transition flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )}

    {/* Calls panel (shown when sub-tab is callbacks) */}
    {(activitySub === 'callbacks') && (
      <div className="mb-5">
        {calls.length === 0 && followups.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E5E5EA] py-10 text-center">
            <PhoneCall size={20} className="text-[#AEAEB2] mx-auto mb-2" />
            <p className="text-[12px] text-[#AEAEB2]">No calls logged yet. Click &quot;Log a call&quot; to add one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map(c => {
              const outcomeLabels: Record<string, { label: string; color: string }> = {
                connected: { label: 'Connected', color: 'text-[#34C759]' },
                no_answer: { label: 'No Answer', color: 'text-[#FF3B30]' },
                busy: { label: 'Busy', color: 'text-[#FF9500]' },
                voicemail: { label: 'Voicemail', color: 'text-[#6E6E73]' },
                left_message: { label: 'Left Message', color: 'text-blue-500' },
              }
              const oc = c.outcome ? outcomeLabels[c.outcome] : null
              return (
                <div key={c.id} className="bg-white rounded-xl border border-[#E5E5EA] px-5 py-4 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <PhoneCall size={14} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-[#1D1D1F]">
                        Call {oc && <span className={`font-medium ${oc.color}`}>· {oc.label}</span>}
                      </p>
                      <span className="text-[11px] text-[#AEAEB2]">{fmtDate(c.call_date)}{c.call_time ? ` ${c.call_time}` : ''}</span>
                    </div>
                    {c.duration_mins && <p className="text-[11px] text-[#6E6E73] mt-0.5">{c.duration_mins} min</p>}
                    {c.notes && <p className="text-[12px] text-[#6E6E73] mt-1">{c.notes}</p>}
                  </div>
                  <button onClick={() => handleDeleteCall(c.id)} className="text-[#AEAEB2] hover:text-[#FF3B30] transition flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
            {followups.map(f => (
              <div key={f.id} className="bg-white rounded-xl border border-[#E5E5EA] px-5 py-4 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <PhoneCall size={14} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#1D1D1F]">Callback reminder</p>
                    <span className="text-[11px] text-[#AEAEB2]">{fmtDate(f.follow_up_date)}</span>
                  </div>
                  <div className="mt-0.5">
                    {f.status === 'completed'
                      ? <span className="text-[11px] text-[#34C759] font-medium flex items-center gap-1"><CheckCircle2 size={11}/> Completed</span>
                      : <span className="text-[11px] text-[#FF9500] font-medium flex items-center gap-1"><Clock size={11}/> Pending</span>}
                  </div>
                  {f.notes && <p className="text-[12px] text-[#6E6E73] mt-1">{f.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* Timeline (All / Notes / Meetings sub-tabs) */}
    {(activitySub === 'all' || activitySub === 'notes' || activitySub === 'meetings') && (
      <>
        {searchFiltered.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E5E5EA] py-16 text-center">
            <MessageSquare size={24} className="text-[#AEAEB2] mx-auto mb-3" />
            <p className="text-[13px] font-semibold text-[#1D1D1F]">No activities yet</p>
            <p className="text-[12px] text-[#AEAEB2] mt-1">Use the buttons above to add notes, log calls or create tasks.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupByMonth(searchFiltered)).map(([month, items]) => (
              <div key={month}>
                <p className="text-[11px] font-bold text-[#AEAEB2] uppercase tracking-wider mb-3">{month}</p>
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    if (item.type === 'callback') {
                      const f = item.data as FollowUp
                      return (
                        <div key={`cb-${f.id}`} className="bg-white rounded-xl border border-[#E5E5EA] px-5 py-4 flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <PhoneCall size={14} className="text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold text-[#1D1D1F]">Callback reminder</p>
                              <span className="text-[11px] text-[#AEAEB2] flex-shrink-0">{fmtDate(f.follow_up_date)}</span>
                            </div>
                            <div className="mt-1">
                              {f.status === 'completed'
                                ? <span className="inline-flex items-center gap-1 text-[11px] text-[#34C759] font-medium"><CheckCircle2 size={11} /> Completed</span>
                                : <span className="inline-flex items-center gap-1 text-[11px] text-[#FF9500] font-medium"><Clock size={11} /> Pending</span>}
                            </div>
                            {f.notes && <p className="text-[12px] text-[#6E6E73] mt-1.5">{f.notes}</p>}
                          </div>
                        </div>
                      )
                    }
                    if (item.type === 'meeting') {
                      const m = item.data as Meeting
                      const outcomeColor = m.outcome === 'completed' ? 'text-[#34C759]' : m.outcome === 'cancelled' ? 'text-[#FF3B30]' : m.outcome === 'rescheduled' ? 'text-[#FF9500]' : 'text-[#AEAEB2]'
                      return (
                        <div key={`mt-${m.id}`} className="bg-white rounded-xl border border-[#E5E5EA] px-5 py-4 flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <Calendar size={14} className="text-purple-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold text-[#1D1D1F]">Meeting</p>
                              <span className="text-[11px] text-[#AEAEB2] flex-shrink-0">{fmtDate(m.meeting_date)} {m.meeting_time}</span>
                            </div>
                            {m.company_name && <p className="text-[12px] text-[#6E6E73] mt-0.5">{m.company_name}</p>}
                            {m.outcome && <p className={`text-[11px] font-medium mt-1 capitalize ${outcomeColor}`}>{m.outcome}</p>}
                            {m.notes && <p className="text-[12px] text-[#6E6E73] mt-1.5">{m.notes}</p>}
                          </div>
                        </div>
                      )
                    }
                    const a = item.data as ActivityEntry
                    return (
                      <div key={`ac-${a.id}-${idx}`} className="bg-white rounded-xl border border-[#E5E5EA] px-5 py-3 flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                          <ActivityIcon action={a.action} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] text-[#1D1D1F]">{a.detail ?? a.action}</p>
                            <span className="text-[11px] text-[#AEAEB2] flex-shrink-0">{relTime(a.created_at)}</span>
                          </div>
                          {a.profiles?.name && <p className="text-[10px] text-[#AEAEB2] mt-0.5">by {a.profiles.name}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
)}

          {/* ─── INTELLIGENCE TAB ─── */}
          {activeTab === 'intelligence' && (
            <div className="max-w-3xl space-y-5">
              {/* Summary bar */}
              <div className="bg-white rounded-xl border border-[#E5E5EA] px-5 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-6 flex-wrap">
                  {[
                    { label: 'Pipeline', value: <PipelineBadge stage={contact.pipeline_status} /> },
                    { label: 'Company', value: contact.company_name },
                    { label: 'Role', value: contact.job_title },
                    { label: 'City', value: contact.city },
                    { label: 'Country', value: contact.country },
                    { label: 'Assigned To', value: contact.assigned_to_name },
                  ].map(({ label, value }) => value ? (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider">{label}</p>
                      <div className="text-[13px] font-medium text-[#1D1D1F] mt-0.5">{value}</div>
                    </div>
                  ) : null)}
                </div>
              </div>

              {/* Contact outreach */}
              <div className="bg-white rounded-xl border border-[#E5E5EA]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="px-5 py-3 border-b border-[#F2F2F7]">
                  <p className="text-[13px] font-semibold text-[#1D1D1F]">Contact Outreach</p>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-4">
                  {contact.email && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Email</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#1D1D1F] truncate">{contact.email}</span>
                        <button onClick={() => copyToClipboard(contact.email!, 'email')}
                          className="text-[#AEAEB2] hover:text-[#1D1D1F] transition flex-shrink-0">
                          {copied === 'email' ? <Check size={12} className="text-[#34C759]" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Phone</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#1D1D1F]">{contact.phone}</span>
                        <button onClick={() => copyToClipboard(contact.phone!, 'phone')}
                          className="text-[#AEAEB2] hover:text-[#1D1D1F] transition flex-shrink-0">
                          {copied === 'phone' ? <Check size={12} className="text-[#34C759]" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {contact.linkedin_url && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">LinkedIn</p>
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[13px] text-blue-500 hover:underline">
                        View profile <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                  {contact.lead_source && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">Lead Source</p>
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-semibold rounded-md border border-blue-100">{contact.lead_source}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Manager note: AI message generation is handled by telecaller */}
              <div className="bg-[#F5F5F7] rounded-xl border border-[#E5E5EA] px-5 py-4">
                <p className="text-[12px] text-[#6E6E73]">
                  AI outreach message generation is available in the telecaller view.
                  {contact.generated_message && (
                    <span className="block mt-2 text-[#1D1D1F]">
                      A message has been generated for this contact.
                    </span>
                  )}
                </p>
                {contact.generated_message && (
                  <div className="mt-3">
                    <p className="text-[13px] text-[#1D1D1F] leading-relaxed whitespace-pre-wrap border-t border-[#E5E5EA] pt-3">{contact.generated_message}</p>
                    <button onClick={() => copyToClipboard(contact.generated_message!, 'msg')}
                      className="mt-2 flex items-center gap-1.5 text-[12px] text-[#AEAEB2] hover:text-[#1D1D1F] transition">
                      {copied === 'msg' ? <><Check size={12} className="text-[#34C759]" /> Copied!</> : <><Copy size={12} /> Copy message</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-l border-[#E5E5EA] bg-white overflow-y-auto">
        {/* Pipeline Stage Tracker */}
        <div className="px-4 py-4 border-b border-[#F2F2F7]">
          <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-3">Pipeline Stage</p>
          {/* Visual progress blocks — like HubSpot's Lead stage tracker */}
          <div className="flex gap-1 mb-3">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isWon = contact.pipeline_status === 'won'
              const isLost = contact.pipeline_status === 'lost'
              const stageIdx = PIPELINE_STAGES.findIndex(s => s.value === contact.pipeline_status)
              let bg = '#E5E5EA'
              if (isLost) {
                bg = idx <= stageIdx ? '#FF3B30' : '#E5E5EA'
              } else if (isWon) {
                bg = '#16A34A'
              } else {
                bg = idx <= stageIdx && stageIdx >= 0 ? stage.dot : '#E5E5EA'
              }
              return (
                <button
                  key={stage.value}
                  onClick={() => handleStageChange(stage.value)}
                  className="flex-1 h-1.5 rounded-full transition-all hover:opacity-70"
                  style={{ backgroundColor: bg }}
                  title={stage.label}
                />
              )
            })}
          </div>
          <div className="space-y-1.5">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isActive = contact.pipeline_status === stage.value
              const isPast = currentStageIdx > idx && !['won', 'lost'].includes(contact.pipeline_status ?? '')
              return (
                <button key={stage.value} onClick={() => handleStageChange(stage.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition
                    ${isActive ? 'ring-1' : 'hover:bg-[#F5F5F7]'}`}
                  style={isActive ? { backgroundColor: stage.bg, outline: `1px solid ${stage.color}` } : {}}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? stage.dot : isPast ? '#34C759' : '#D1D1D6' }} />
                  <span className="text-[12px] font-medium" style={{ color: isActive ? stage.color : '#6E6E73' }}>
                    {stage.label}
                  </span>
                  {isActive && <ChevronRight size={12} className="ml-auto flex-shrink-0" style={{ color: stage.color }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Assigned Telecaller */}
        {contact.assigned_to_name && (
          <div className="px-4 py-4 border-b border-[#F2F2F7]">
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">Assigned To</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                <User size={12} className="text-[#6E6E73]" />
              </div>
              <span className="text-[13px] text-[#1D1D1F] font-medium">{contact.assigned_to_name}</span>
            </div>
          </div>
        )}

        {/* Upcoming Callbacks */}
        <div className="px-4 py-4 border-b border-[#F2F2F7]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider">
              Callbacks ({followups.length})
            </p>
            <Link href="/sales/manager/followups" className="text-[11px] text-[#DC2626] hover:underline">View all</Link>
          </div>
          {followups.length === 0 ? (
            <p className="text-[12px] text-[#AEAEB2]">No callbacks yet</p>
          ) : (
            <div className="space-y-2">
              {followups.slice(0, 4).map(f => (
                <div key={f.id} className="bg-[#F5F5F7] rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#1D1D1F]">{fmtDate(f.follow_up_date)}</span>
                    {f.status === 'completed'
                      ? <CheckCircle2 size={12} className="text-[#34C759]" />
                      : <Clock size={12} className="text-[#FF9500]" />}
                  </div>
                  {f.notes && <p className="text-[11px] text-[#6E6E73] mt-0.5 truncate">{f.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meetings */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider">
              Meetings ({meetings.length})
            </p>
            <Link href="/sales/manager/meetings" className="text-[11px] text-[#DC2626] hover:underline">View all</Link>
          </div>
          {meetings.length === 0 ? (
            <p className="text-[12px] text-[#AEAEB2]">No meetings yet</p>
          ) : (
            <div className="space-y-2">
              {meetings.slice(0, 4).map(m => (
                <div key={m.id} className="bg-[#F5F5F7] rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#1D1D1F]">{fmtDate(m.meeting_date)}</span>
                    {m.outcome === 'completed' ? <CheckCircle2 size={12} className="text-[#34C759]" />
                      : m.outcome === 'cancelled' ? <X size={12} className="text-[#FF3B30]" />
                      : <Calendar size={12} className="text-purple-500" />}
                  </div>
                  {m.company_name && <p className="text-[11px] text-[#6E6E73] mt-0.5 truncate">{m.company_name}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
