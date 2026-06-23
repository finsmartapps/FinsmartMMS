'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  Upload, Search, Network, Send, Users, Clock, Loader2,
  CheckCircle2, X, ExternalLink, ChevronLeft, ChevronRight, ArrowRight,
  Pencil, Trash2, Tag, List, ChevronDown, UserPlus,
} from 'lucide-react'
import { ListsModal } from '@/components/sales/linkedin/ListsModal'
import { GEO_COUNTRIES, getStatesForCountry } from '@/lib/geo'

interface LinkedInList { id: string; name: string; description: string | null; contact_count: number }
interface Telecaller { id: string; name: string }
interface Contact {
  id: string; assigned_to: string | null
  first_name: string; last_name: string | null
  email: string | null; phone: string | null
  company_name: string | null; job_title: string | null
  linkedin_url: string | null; lead_source: string | null
  city: string | null; state: string | null; country: string | null
  status: 'queued' | 'request_sent'
  pipeline_status: 'new' | 'contacted' | 'interested' | 'won' | 'lost' | null
  request_sent_at: string | null
  created_at: string
}
interface Breakdown { id: string; name: string; total: number; sent: number; pending: number }
interface Totals { totalAll: number; totalSent: number; totalPending: number }
interface Pipeline { new?: number; contacted?: number; interested?: number; won?: number; lost?: number }

// ── Field schema for column mapping ──────────────────────────────────────────
const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company_name', label: 'Company' },
  { key: 'job_title', label: 'Job Title' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
  { key: 'lead_source', label: 'Lead Source' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
]

// Heuristic match between our field and a CSV column name
const AUTO_MAP_HINTS: Record<string, string[]> = {
  first_name: ['first name', 'firstname', 'first_name', 'fname', 'given name'],
  last_name: ['last name', 'lastname', 'last_name', 'lname', 'surname', 'family name'],
  email: ['email', 'email address', 'e-mail', 'mail'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'tel'],
  company_name: ['company', 'company name', 'organization', 'organisation', 'employer', 'firm'],
  job_title: ['job title', 'title', 'designation', 'position', 'role', 'job'],
  linkedin_url: ['linkedin', 'linkedin url', 'linkedin profile', 'profile url', 'linkedin_url'],
  lead_source: ['lead source', 'source', 'lead_source', 'channel'],
  city: ['city', 'location', 'town'],
  country: ['country', 'nation'],
}

function autoDetectMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const lowered = headers.map(h => h.toLowerCase().trim())
  for (const field of FIELDS) {
    const hints = AUTO_MAP_HINTS[field.key] ?? []
    for (const h of hints) {
      const idx = lowered.indexOf(h)
      if (idx !== -1) { map[field.key] = headers[idx]; break }
    }
  }
  return map
}

type RawRow = Record<string, string>
interface ParsedFile { headers: string[]; rows: RawRow[] }

async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    const text = await file.text()
    const res = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true })
    const headers = res.meta.fields ?? []
    return { headers, rows: res.data }
  }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '' })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

// ── Pipeline stage helpers ────────────────────────────────────────────────────
function pipelinePill(stage: string | null) {
  if (!stage) return null
  const map: Record<string, { bg: string; text: string; label: string }> = {
    new:       { bg: 'bg-[#F5F5F7]', text: 'text-[#6E6E73]', label: 'New' },
    contacted: { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'Contacted' },
    interested:{ bg: 'bg-orange-50', text: 'text-[#FF9500]',  label: 'Interested' },
    won:       { bg: 'bg-green-50',  text: 'text-[#34C759]',  label: 'Won' },
    lost:      { bg: 'bg-red-50',    text: 'text-[#FF3B30]',  label: 'Lost' },
  }
  const s = map[stage] ?? map.new
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border border-transparent ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

// ── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ telecallers, onClose, onDone }: {
  telecallers: Telecaller[]; onClose: () => void; onDone: (msg: string) => void
}) {
  const [step, setStep] = useState<'pick' | 'map'>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [assignedTo, setAssignedTo] = useState('')
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleNext() {
    setError('')
    if (!file) { setError('Please select a file.'); return }
    if (!assignedTo) { setError('Please select a telecaller.'); return }
    setParsing(true)
    try {
      const p = await parseFile(file)
      if (p.rows.length === 0) {
        setError('File is empty or could not be parsed.'); setParsing(false); return
      }
      setParsed(p)
      setMapping(autoDetectMapping(p.headers))
      setStep('map')
    } catch (err) {
      setError(`Failed to read file: ${(err as Error).message}`)
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!parsed) return
    if (!mapping.first_name) { setError('First Name mapping is required.'); return }
    setError(''); setUploading(true)

    // Apply mapping to all rows
    const contacts = parsed.rows.map(r => {
      const out: Record<string, string | null> = {}
      for (const field of FIELDS) {
        const col = mapping[field.key]
        out[field.key] = col ? (r[col]?.toString().trim() || null) : null
      }
      return out
    })

    const res = await fetch('/api/manager/contacts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: assignedTo, contacts }),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Import failed.'); setUploading(false); return }
    onDone(d.message)
  }

  const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${step === 'map' ? 'max-w-3xl' : 'max-w-md'} flex flex-col max-h-[92vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F2F7] flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-[#1D1D1F]">Import Contacts</h2>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">
              {step === 'pick' ? 'Step 1 of 2 — Select file & telecaller' : `Step 2 of 2 — Map columns (${parsed?.rows.length.toLocaleString() ?? 0} rows detected)`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition"><X size={18} /></button>
        </div>

        {step === 'pick' && (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">CSV or Excel file *</label>
              <div onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${file ? 'border-[#DC2626] bg-red-50' : 'border-[#E5E5EA] hover:border-[#DC2626]/40 hover:bg-[#FAFAFA]'}`}>
                <Upload size={20} className={`mx-auto mb-2 ${file ? 'text-[#DC2626]' : 'text-[#AEAEB2]'}`} />
                {file
                  ? <p className="text-[13px] font-semibold text-[#DC2626]">{file.name}</p>
                  : <><p className="text-[13px] font-medium text-[#1D1D1F]">Click to upload</p><p className="text-[11px] text-[#AEAEB2] mt-0.5">CSV or Excel (.xlsx / .xls)</p></>
                }
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Assign to *</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={inputCls}>
                <option value="">Select telecaller…</option>
                {telecallers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-blue-700 mb-1 uppercase tracking-wider">What happens next</p>
              <p className="text-[12px] text-blue-700 leading-relaxed">
                You&apos;ll see all columns from your file and choose which one to use for each field. <strong>First Name</strong> is required — rows missing it will be skipped automatically. LinkedIn URL is optional but recommended.
              </p>
            </div>

            {error && <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-[#E5E5EA] text-[#6E6E73] rounded-xl py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">Cancel</button>
              <button type="button" onClick={handleNext} disabled={parsing}
                className="flex-1 bg-[#DC2626] hover:bg-[#C91C1C] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {parsing ? <><Loader2 size={14} className="animate-spin" /> Reading…</> : <>Next: Map Columns <ArrowRight size={14} /></>}
              </button>
            </div>
          </div>
        )}

        {step === 'map' && parsed && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-[#F5F5F7] rounded-xl px-4 py-3">
                <p className="text-[12px] text-[#6E6E73]">
                  Columns detected in your file: <strong>{parsed.headers.join(' · ')}</strong>
                </p>
              </div>

              {/* Mapping table */}
              <div className="border border-[#E5E5EA] rounded-xl overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#FAFAFA] border-b border-[#F2F2F7]">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Our field</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Your file column</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Sample value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F2F7]">
                    {FIELDS.map(f => {
                      const sel = mapping[f.key] ?? ''
                      const sample = sel && parsed.rows[0] ? parsed.rows[0][sel] : ''
                      return (
                        <tr key={f.key} className="hover:bg-[#FAFAFA]">
                          <td className="px-4 py-2.5 font-medium text-[#1D1D1F] whitespace-nowrap">
                            {f.label} {f.required && <span className="text-[#DC2626]">*</span>}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={sel}
                              onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                              className={`${inputCls} py-1.5 ${f.required && !sel ? 'border-[#DC2626]' : ''}`}>
                              <option value="">— Skip —</option>
                              {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-[#AEAEB2] max-w-[180px] truncate">{sample || <span className="italic">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {error && <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
            </div>

            <div className="px-5 py-4 border-t border-[#F2F2F7] flex items-center gap-3 flex-shrink-0">
              <button type="button" onClick={() => setStep('pick')}
                className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition font-medium">
                <ChevronLeft size={14} /> Back
              </button>
              <div className="ml-auto flex gap-3">
                <button type="button" onClick={onClose}
                  className="border border-[#E5E5EA] text-[#6E6E73] rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">Cancel</button>
                <button type="button" onClick={handleImport} disabled={uploading || !mapping.first_name}
                  className="bg-[#DC2626] hover:bg-[#C91C1C] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                  {uploading ? <><Loader2 size={14} className="animate-spin" /> Importing…</> : <><Upload size={14} /> Import Contacts</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── AddContactModal ───────────────────────────────────────────────────────────
function AddContactModal({ telecallers, onClose, onDone }: {
  telecallers: Telecaller[]; onClose: () => void; onDone: () => void
}) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    company_name: '', job_title: '', linkedin_url: '',
    lead_source: '', city: '', state: '', country: '', notes: '', assigned_to: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) { setError('First Name is required.'); return }
    setError(''); setSaving(true)
    try {
      const body: Record<string, string | null> = {}
      for (const [k, v] of Object.entries(form)) {
        body[k] = v.trim() || null
      }
      const res = await fetch('/api/manager/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Failed to create contact.'); setSaving(false); return }
      onDone()
    } catch {
      setError('An unexpected error occurred.'); setSaving(false)
    }
  }

  const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-[13px] text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA]'
  const labelCls = 'block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F2F7] flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-[#1D1D1F]">Add Contact</h2>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">Fields marked * are required</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name *</label>
                <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                  placeholder="Jane" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                  placeholder="Doe" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="jane@example.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+91 99999 00000" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Company</label>
                <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
                  placeholder="Acme Corp" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Job Title</label>
                <input value={form.job_title} onChange={e => set('job_title', e.target.value)}
                  placeholder="Head of Sales" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>LinkedIn URL</label>
              <input value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/in/janedoe" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Lead Source</label>
                <input value={form.lead_source} onChange={e => set('lead_source', e.target.value)}
                  placeholder="LinkedIn, Referral…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Assigned To</label>
                <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className={inputCls}>
                  <option value="">Select telecaller…</option>
                  {telecallers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Country</label>
                <select value={form.country} onChange={e => { set('country', e.target.value); set('state', '') }} className={inputCls}>
                  <option value="">Select country…</option>
                  {GEO_COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>State / Region</label>
                <select value={form.state} onChange={e => set('state', e.target.value)} className={inputCls} disabled={!form.country}>
                  <option value="">{form.country ? 'Select state…' : 'Select country first'}</option>
                  {getStatesForCountry(form.country).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)}
                placeholder="e.g. New York" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={3} placeholder="Any additional notes…"
                className={`${inputCls} resize-none`} />
            </div>

            {error && <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
          </div>

          <div className="px-5 py-4 border-t border-[#F2F2F7] flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#E5E5EA] text-[#6E6E73] rounded-xl py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-[#DC2626] hover:bg-[#C91C1C] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><UserPlus size={14} /> Add Contact</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [telecallers, setTelecallers] = useState<Telecaller[]>([])
  const [breakdown, setBreakdown] = useState<Breakdown[]>([])
  const [totals, setTotals] = useState<Totals>({ totalAll: 0, totalSent: 0, totalPending: 0 })
  const [pipeline, setPipeline] = useState<Pipeline>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [filterPipeline, setFilterPipeline] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lists, setLists] = useState<LinkedInList[]>([])
  const [filterList, setFilterList] = useState('')
  const [showListsPanel, setShowListsPanel] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)

  const load = useCallback(async (p = 1, s = search, st = filterStatus, u = filterUser, fl = filterList, fp = filterPipeline) => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p) })
    if (s) q.set('search', s)
    if (st) q.set('status', st)
    if (u) q.set('assigned_to', u)
    if (fl) q.set('list_id', fl)
    if (fp) q.set('pipeline_status', fp)
    const res = await fetch(`/api/manager/contacts?${q}`)
    const d = await res.json()
    setContacts(d.contacts ?? [])
    setTotal(d.total ?? 0)
    setTelecallers(d.telecallers ?? [])
    setBreakdown(d.breakdown ?? [])
    setTotals(d.totals ?? { totalAll: 0, totalSent: 0, totalPending: 0 })
    setPipeline(d.pipeline ?? {})
    setPage(p)
    setLoading(false)
  }, [search, filterStatus, filterUser, filterList, filterPipeline])

  useEffect(() => {
    load()
    fetch('/api/linkedin/lists').then(r => r.json()).then(d => setLists(d.lists ?? []))
  }, [load])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(1, search, filterStatus, filterUser, filterList, filterPipeline), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const ownerName = (id: string | null) => id ? (telecallers.find(t => t.id === id)?.name ?? 'Unknown') : '—'

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

  // Bulk action handlers
  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} contact(s)? This cannot be undone.`)) return
    await fetch('/api/manager/contacts', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: [...selected] }),
    })
    setSelected(new Set()); load()
  }
  async function handleDeleteSingle(id: string) {
    if (!confirm('Delete this contact?')) return
    await fetch(`/api/manager/contacts/${id}`, { method: 'DELETE' })
    setContacts(prev => prev.filter(c => c.id !== id))
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

  const pipelineFilterOptions: DropFilterOption[] = [
    { value: 'new',        label: 'New',        count: pipeline.new        ?? 0 },
    { value: 'contacted',  label: 'Contacted',  count: pipeline.contacted  ?? 0 },
    { value: 'interested', label: 'Interested', count: pipeline.interested ?? 0 },
    { value: 'won',        label: 'Won',        count: pipeline.won        ?? 0 },
    { value: 'lost',       label: 'Lost',       count: pipeline.lost       ?? 0 },
  ]
  const ownerFilterOptions: DropFilterOption[] = telecallers.map(t => ({ value: t.id, label: t.name }))

  const listTabs = [{ id: '', name: 'All Contacts', contact_count: totals.totalAll }, ...lists]
  const hasFilters = !!(search || filterStatus || filterPipeline || filterUser || filterList)

  return (
    <>
      {showListsPanel && (
        <ListsModal
          onClose={() => setShowListsPanel(false)}
          onListsChanged={() => fetch('/api/linkedin/lists').then(r => r.json()).then(d => setLists(d.lists ?? []))}
        />
      )}
      {importing && (
        <ImportModal
          telecallers={telecallers}
          onClose={() => setImporting(false)}
          onDone={msg => { setImporting(false); setImportMsg(msg); load() }}
        />
      )}
      {showAddContact && (
        <AddContactModal
          telecallers={telecallers}
          onClose={() => setShowAddContact(false)}
          onDone={() => { setShowAddContact(false); load() }}
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
              <List size={14} /> Manage Lists
            </button>
            <button onClick={() => setShowAddContact(true)}
              className="flex items-center gap-1.5 h-9 px-3.5 border border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] text-[13px] font-medium rounded-lg transition">
              <UserPlus size={14} /> Add Contact
            </button>
            <button onClick={() => { setImportMsg(''); setImporting(true) }}
              className="flex items-center gap-1.5 h-9 px-3.5 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-[13px] font-semibold rounded-lg transition">
              <Upload size={14} /> Import
            </button>
          </div>
        </div>

        {/* Import success */}
        {importMsg && (
          <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3.5 mb-4">
            <CheckCircle2 size={15} className="text-[#34C759] flex-shrink-0 mt-0.5" />
            <p className="flex-1 text-[13px] text-green-700 font-medium">{importMsg}</p>
            <button onClick={() => setImportMsg('')} className="text-green-700/50 hover:text-green-700 transition"><X size={14} /></button>
          </div>
        )}

        {/* List view tabs */}
        <div className="flex items-center border-b border-[#E5E5EA] overflow-x-auto -mx-6 px-6" style={{ scrollbarWidth: 'none' }}>
          {listTabs.map(tab => (
            <button key={tab.id || 'all'}
              onClick={() => { setFilterList(tab.id); load(1, search, filterStatus, filterUser, tab.id, filterPipeline) }}
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
            onChange={v => { setFilterPipeline(v); load(1, search, filterStatus, filterUser, filterList, v) }} />
          <DropFilter label="Owner" value={filterUser} options={ownerFilterOptions}
            onChange={v => { setFilterUser(v); load(1, search, filterStatus, v, filterList, filterPipeline) }} />
          <div className="flex-1" />
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="pl-8 pr-3 h-8 border border-[#E5E5EA] rounded-lg text-[12px] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/10 transition bg-white w-56" />
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPipeline(''); setFilterUser(''); setFilterList(''); load(1,'','','','','') }}
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
                {totals.totalAll === 0 ? 'No contacts yet' : 'No contacts match your filters'}
              </p>
              <p className="text-[12px] text-[#AEAEB2] mt-1">
                {totals.totalAll === 0 ? 'Add or import contacts to get started.' : 'Try adjusting your search or filters.'}
              </p>
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
                    {['Name', 'Company', 'Pipeline Stage', 'Owner', 'Lead Source', 'Location', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id} className="border-b border-[#F2F2F7] hover:bg-[#FAFAFA] transition group last:border-b-0">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)}
                          className="w-3.5 h-3.5 rounded border-[#D1D1D6] text-[#DC2626] cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <ContactAvatar name={`${c.first_name} ${c.last_name ?? ''}`} />
                          <div>
                            <button onClick={() => router.push(`/manager/contacts/${c.id}`)}
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
                        {pipelinePill(c.pipeline_status) ?? <span className="text-[#AEAEB2] text-[13px]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[10px] font-bold text-[#6E6E73] flex-shrink-0">
                            {ownerName(c.assigned_to).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[13px] text-[#1D1D1F] whitespace-nowrap">{ownerName(c.assigned_to)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.lead_source
                          ? <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-semibold rounded-md border border-blue-100">{c.lead_source}</span>
                          : <span className="text-[#AEAEB2] text-[13px]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6E6E73] whitespace-nowrap">
                        {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#6E6E73] whitespace-nowrap">
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => router.push(`/manager/contacts/${c.id}`)}
                            className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDeleteSingle(c.id)}
                            className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#FF3B30] hover:bg-red-50 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
