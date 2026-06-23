'use client'

import { useState, useEffect } from 'react'
import {
  X, Save, Loader2, CheckCircle2, RotateCcw, Send, ExternalLink, Network, Calendar,
  Activity, SendHorizonal, FileEdit, StickyNote, Trash2,
} from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import { GEO_COUNTRIES, getStatesForCountry } from '@/lib/geo'

export interface LinkedInContactDetail {
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
  status: 'queued' | 'request_sent'
  request_sent_at: string | null
  pipeline_status: 'new' | 'contacted' | 'interested' | 'won' | 'lost'
  notes: string | null
  created_at: string
}

interface ActivityEntry {
  id: string
  action: string
  detail: string | null
  created_at: string
  profiles: { name: string } | null
}

interface Props {
  contact: LinkedInContactDetail
  onClose: () => void
  onSaved: (updated: LinkedInContactDetail) => void
  onDelete?: (id: string) => void
  apiBase?: string
}

const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'
const labelCls = 'block text-[11px] font-semibold text-[#6E6E73] mb-1.5 uppercase tracking-wider'

function ActivityIcon({ action }: { action: string }) {
  if (action === 'status_changed') return <SendHorizonal size={11} className="text-[#34C759]" />
  if (action === 'message_generated') return <Activity size={11} className="text-blue-500" />
  if (action === 'note_added') return <StickyNote size={11} className="text-[#FF9500]" />
  return <FileEdit size={11} className="text-[#AEAEB2]" />
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(iso.split('T')[0])
}

const PIPELINE_STAGES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'new',        label: 'New',        color: 'text-[#6E6E73]',  bg: 'bg-[#F5F5F7] border-[#E5E5EA]' },
  { value: 'contacted',  label: 'Contacted',  color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100' },
  { value: 'interested', label: 'Interested', color: 'text-[#FF9500]',  bg: 'bg-orange-50 border-orange-100' },
  { value: 'won',        label: 'Won',        color: 'text-[#34C759]',  bg: 'bg-green-50 border-green-100' },
  { value: 'lost',       label: 'Lost',       color: 'text-[#FF3B30]',  bg: 'bg-red-50 border-red-100' },
]

export function ContactDetailModal({ contact, onClose, onSaved, onDelete, apiBase = '/api/telecaller/contacts' }: Props) {
  const [form, setForm] = useState({
    first_name: contact.first_name,
    last_name: contact.last_name ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company_name: contact.company_name ?? '',
    job_title: contact.job_title ?? '',
    linkedin_url: contact.linkedin_url ?? '',
    lead_source: contact.lead_source ?? '',
    city: contact.city ?? '',
    state: contact.state ?? '',
    country: contact.country ?? '',
    notes: contact.notes ?? '',
  })
  const [status, setStatus] = useState(contact.status)
  const [pipelineStatus, setPipelineStatus] = useState(contact.pipeline_status ?? 'new')
  const [saving, setSaving] = useState(false)
  const [statusToggling, setStatusToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  useEffect(() => {
    fetch(`${apiBase}/${contact.id}/activity`)
      .then(r => r.json())
      .then(d => { setActivityLog(d.activity ?? []); setActivityLoading(false) })
      .catch(() => setActivityLoading(false))
  }, [contact.id, apiBase])

  // Dirty check
  const isDirty =
    form.first_name !== contact.first_name ||
    form.last_name !== (contact.last_name ?? '') ||
    form.email !== (contact.email ?? '') ||
    form.phone !== (contact.phone ?? '') ||
    form.company_name !== (contact.company_name ?? '') ||
    form.job_title !== (contact.job_title ?? '') ||
    form.linkedin_url !== (contact.linkedin_url ?? '') ||
    form.lead_source !== (contact.lead_source ?? '') ||
    form.city !== (contact.city ?? '') ||
    form.state !== (contact.state ?? '') ||
    form.country !== (contact.country ?? '') ||
    form.notes !== (contact.notes ?? '')

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    setSaving(true); setError('')
    const res = await fetch(`${apiBase}/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Save failed.'); setSaving(false); return }
    setSaving(false)
    fetch(`${apiBase}/${contact.id}/activity`)
      .then(r => r.json())
      .then(d => setActivityLog(d.activity ?? []))
      .catch(() => null)
    onSaved(d.contact as LinkedInContactDetail)
  }

  async function toggleStatus() {
    setStatusToggling(true); setError('')
    const next = status === 'queued' ? 'request_sent' : 'queued'
    const res = await fetch(`${apiBase}/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Status update failed.'); setStatusToggling(false); return }
    setStatus(next)
    setStatusToggling(false)
    fetch(`${apiBase}/${contact.id}/activity`)
      .then(r => r.json())
      .then(d => setActivityLog(d.activity ?? []))
      .catch(() => null)
    onSaved(d.contact as LinkedInContactDetail)
  }

  async function handleStageChange(stage: string) {
    if (stage === pipelineStatus) return
    const res = await fetch(`${apiBase}/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_status: stage }),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Stage update failed.'); return }
    setPipelineStatus(stage as typeof pipelineStatus)
    fetch(`${apiBase}/${contact.id}/activity`)
      .then(r => r.json())
      .then(d => setActivityLog(d.activity ?? []))
      .catch(() => null)
    onSaved({ ...contact, pipeline_status: stage as LinkedInContactDetail['pipeline_status'] })
  }

  async function handleDelete() {
    if (!onDelete) return
    if (!confirm('Delete this contact? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`${apiBase}/${contact.id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Delete failed.'); setDeleting(false); return }
    onDelete(contact.id)
  }

  const isSent = status === 'request_sent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#F2F2F7] flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[16px] flex-shrink-0">
              {form.first_name.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-[#1D1D1F] leading-tight truncate">
                {form.first_name} {form.last_name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {isSent
                  ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#34C759] bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                      <CheckCircle2 size={10} /> Request Sent
                    </span>
                  : <span className="text-[11px] font-semibold text-[#AEAEB2] bg-[#F5F5F7] px-2 py-0.5 rounded-full border border-[#E5E5EA]">Pending</span>
                }
                {contact.request_sent_at && (
                  <span className="text-[11px] text-[#AEAEB2] flex items-center gap-1">
                    <Calendar size={10} /> Sent {formatShortDate(contact.request_sent_at.split('T')[0])}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Status toggle */}
        <div className="px-5 py-3 bg-[#FAFAFA] border-b border-[#F2F2F7] flex items-center gap-3 flex-shrink-0">
          <p className="text-[12px] text-[#6E6E73] font-medium">Task status</p>
          <button
            onClick={toggleStatus}
            disabled={statusToggling}
            className={`ml-auto flex items-center gap-2 text-[12px] font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 ${
              isSent
                ? 'bg-white border border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F]'
                : 'bg-[#DC2626] hover:bg-[#C91C1C] text-white'
            }`}>
            {statusToggling
              ? <Loader2 size={13} className="animate-spin" />
              : isSent ? <RotateCcw size={13} /> : <Send size={13} />}
            {isSent ? 'Mark as Pending (undo)' : 'Mark as Request Sent'}
          </button>
        </div>

        {/* Pipeline stage */}
        <div className="px-5 py-3 border-b border-[#F2F2F7] flex-shrink-0">
          <p className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Pipeline Stage</p>
          <div className="flex gap-1.5 flex-wrap">
            {PIPELINE_STAGES.map(s => (
              <button key={s.value} onClick={() => handleStageChange(s.value)}
                className={`px-3 py-1 rounded-lg text-[12px] font-semibold border transition ${
                  pipelineStatus === s.value
                    ? `${s.bg} ${s.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-white border-[#E5E5EA] text-[#AEAEB2] hover:border-[#C7C7CC]'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Name section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name *</label>
              <input value={form.first_name} onChange={e => update('first_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input value={form.last_name} onChange={e => update('last_name', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} placeholder="email@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)} className={inputCls} placeholder="+91 …" />
            </div>
          </div>

          {/* Job */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Company</label>
              <input value={form.company_name} onChange={e => update('company_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Job Title</label>
              <input value={form.job_title} onChange={e => update('job_title', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* LinkedIn URL */}
          <div>
            <label className={labelCls}>LinkedIn URL</label>
            <div className="flex gap-2">
              <input value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} className={inputCls} placeholder="https://linkedin.com/in/…" />
              {form.linkedin_url && (
                <a href={form.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100 transition text-[12px] font-semibold flex-shrink-0">
                  <Network size={13} /> Open <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Country</label>
              <select
                value={form.country}
                onChange={e => { update('country', e.target.value); update('state', '') }}
                className={inputCls}
              >
                <option value="">Select country…</option>
                {GEO_COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>State / Region</label>
              <select
                value={form.state}
                onChange={e => update('state', e.target.value)}
                className={inputCls}
                disabled={!form.country}
              >
                <option value="">{form.country ? 'Select state…' : 'Select country first'}</option>
                {getStatesForCountry(form.country).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input value={form.city} onChange={e => update('city', e.target.value)} placeholder="e.g. New York" className={inputCls} />
          </div>

          {/* Lead Source */}
          <div>
            <label className={labelCls}>Lead Source</label>
            <input value={form.lead_source} onChange={e => update('lead_source', e.target.value)} className={inputCls} placeholder="e.g. LinkedIn Search, Referral…" />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (private)</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={3}
              placeholder="Anything worth remembering about this contact…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

          {/* ── Activity feed ── */}
          <div className="border-t border-[#F2F2F7] pt-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Activity size={13} className="text-[#AEAEB2]" />
              <p className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Activity</p>
            </div>
            {activityLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-[#AEAEB2]" />
              </div>
            ) : activityLog.length === 0 ? (
              <p className="text-[12px] text-[#AEAEB2] italic">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {activityLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ActivityIcon action={entry.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#1D1D1F]">{entry.detail ?? entry.action}</p>
                      <p className="text-[11px] text-[#AEAEB2] mt-0.5">{relativeTime(entry.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#F2F2F7] flex items-center gap-3 flex-shrink-0">
          <button onClick={handleSave} disabled={saving || !isDirty}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="text-[13px] text-[#AEAEB2] hover:text-[#6E6E73] transition">
            {isDirty ? 'Discard' : 'Close'}
          </button>
          {onDelete && (
            <button onClick={handleDelete} disabled={deleting}
              className="ml-auto flex items-center gap-1.5 text-[13px] text-[#AEAEB2] hover:text-[#FF3B30] transition disabled:opacity-40">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
