'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/marketing/ui/input'
import { Label } from '@/components/marketing/ui/label'
import { Textarea } from '@/components/marketing/ui/textarea'
import { Button } from '@/components/marketing/ui/button'
import { Check, Loader2, Plus, Pencil, X } from 'lucide-react'
import {
  LEAD_SOURCES, LEAD_FROM, LEAD_STAGES, LEAD_STATUSES, CUSTOMER_TYPES,
  classifyLeadSource, CATEGORY_STYLES, defaultStatusFromSource,
  CLOSED_WON_STAGE, hoursToSeats, formatSeats, annualContractValue, formatUSD,
} from '@/lib/leads'
import type { Lead } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  initial?: Lead | null
  dataSourceSuggestions: string[]
  industrySuggestions: string[]
  serviceSuggestions: string[]
  assigneeSuggestions: string[]
}

const EMPTY = {
  lead_date: '', name: '', email: '', phone: '', website_url: '', company_name: '',
  industry: '', service_required: '', data_source: '', lead_from: '', lead_source: '',
  state: '', country: '', comment: '', assigned_to: '', lead_status: '',
  became_sql_date: '', lead_stage: 'New', customer_type: '',
  closed_hours: '', mrr_value: '', one_time_revenue: '', closed_date: '',
}
type FormState = typeof EMPTY

function toForm(lead: Lead): FormState {
  return {
    lead_date: lead.lead_date ?? '', name: lead.name ?? '', email: lead.email ?? '',
    phone: lead.phone ?? '', website_url: lead.website_url ?? '', company_name: lead.company_name ?? '',
    industry: lead.industry ?? '', service_required: lead.service_required ?? '',
    data_source: lead.data_source ?? '', lead_from: lead.lead_from ?? '', lead_source: lead.lead_source ?? '',
    state: lead.state ?? '', country: lead.country ?? '', comment: lead.comment ?? '',
    assigned_to: lead.assigned_to ?? '', lead_status: lead.lead_status ?? '',
    became_sql_date: lead.became_sql_date ?? '', lead_stage: lead.lead_stage || 'New',
    customer_type: lead.customer_type ?? '',
    closed_hours: lead.closed_hours != null ? String(lead.closed_hours) : '',
    mrr_value: lead.mrr_value != null ? String(lead.mrr_value) : '',
    one_time_revenue: lead.one_time_revenue != null ? String(lead.one_time_revenue) : '',
    closed_date: lead.closed_date ?? '',
  }
}

export default function LeadFormModal({
  open, onClose, initial, dataSourceSuggestions, industrySuggestions, serviceSuggestions, assigneeSuggestions,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const isEdit = !!initial?.id
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [statusTouched, setStatusTouched] = useState(false)
  const [f, setF] = useState<FormState>({ ...EMPTY })

  // Reset the form each time the modal opens
  useEffect(() => {
    if (open) {
      setF(initial ? toForm(initial) : { ...EMPTY })
      setStatusTouched(!!initial?.lead_status)
      setError(''); setSaved(false)
    }
  }, [open, initial])

  const set = (k: keyof FormState, v: string) => setF(p => ({ ...p, [k]: v }))
  const category = f.lead_source ? classifyLeadSource(f.lead_source) : null

  function setSource(v: string) {
    setF(p => ({ ...p, lead_source: v, lead_status: statusTouched ? p.lead_status : defaultStatusFromSource(v) }))
  }
  function setStatus(v: string) { setStatusTouched(true); set('lead_status', v) }

  async function handleSave() {
    if (!f.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')

    const today = new Date().toISOString().split('T')[0]
    const leadDate = f.lead_date || today
    const isWon = f.lead_stage === CLOSED_WON_STAGE
    const num = (v: string) => (v.trim() === '' ? null : Number(v))
    const emailTrim = f.email.trim()

    // ── Email uniqueness pre-check (blank email is allowed) ──
    if (emailTrim) {
      const escaped = emailTrim.replace(/([%_\\])/g, '\\$1') // ilike wildcards must be literal
      let q = supabase.from('leads').select('id').ilike('email', escaped)
      if (isEdit) q = q.neq('id', initial!.id)
      const { data: dupes } = await q.limit(1)
      if (dupes && dupes.length > 0) {
        setSaving(false)
        setError(`A lead with the email "${emailTrim}" already exists.`)
        return
      }
    }

    const payload = {
      ...f,
      email: emailTrim,
      lead_date: leadDate,
      became_sql_date: f.became_sql_date || null,
      closed_hours: num(f.closed_hours),
      mrr_value: num(f.mrr_value),
      one_time_revenue: num(f.one_time_revenue),
      // stamp a close date automatically when the deal is won (kept if already set)
      closed_date: isWon ? (f.closed_date || leadDate) : (f.closed_date || null),
      category: f.lead_source ? classifyLeadSource(f.lead_source) : '',
      updated_at: new Date().toISOString(),
    }

    const { error } = isEdit
      ? await supabase.from('leads').update(payload).eq('id', initial!.id)
      : await supabase.from('leads').insert(payload)

    setSaving(false)
    if (error) {
      // 23505 = unique_violation (DB-level guarantee, in case of a race)
      setError(error.code === '23505'
        ? `A lead with the email "${emailTrim}" already exists.`
        : error.message)
      return
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose(); router.refresh() }, 800)
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-sm p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 my-4 animate-rise">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              {isEdit
                ? <Pencil className="text-white" style={{ width: 17, height: 17 }} strokeWidth={2.5} />
                : <Plus className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{isEdit ? 'Edit Lead' : 'Add New Lead'}</h3>
              <p className="text-xs text-slate-400">
                {isEdit ? `#${initial!.sr_no} · ${initial!.name}` : 'Auto-classifies into the funnel by Lead Source'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="p-6 space-y-5">
          <Section title="Contact">
            <Field label="Name" required><TextInput value={f.name} onChange={v => set('name', v)} placeholder="Full name" /></Field>
            <Field label="Email"><TextInput type="email" value={f.email} onChange={v => set('email', v)} placeholder="name@company.com" /></Field>
            <Field label="Phone"><TextInput value={f.phone} onChange={v => set('phone', v)} placeholder="+1 …" /></Field>
            <Field label="Date"><TextInput type="date" value={f.lead_date} onChange={v => set('lead_date', v)} /></Field>
          </Section>

          <Section title="Company">
            <Field label="Company Name"><TextInput value={f.company_name} onChange={v => set('company_name', v)} /></Field>
            <Field label="Website URL"><TextInput value={f.website_url} onChange={v => set('website_url', v)} placeholder="https://" /></Field>
            <Field label="Industry"><TextInput value={f.industry} onChange={v => set('industry', v)} list="industry-suggest" /></Field>
            <Field label="Service Required"><TextInput value={f.service_required} onChange={v => set('service_required', v)} list="service-suggest" /></Field>
            <Field label="State"><TextInput value={f.state} onChange={v => set('state', v)} /></Field>
            <Field label="Country"><TextInput value={f.country} onChange={v => set('country', v)} /></Field>
          </Section>

          <Section title="Source & Attribution">
            <Field label="Lead Source">
              <SelectInput value={f.lead_source} onChange={setSource} options={LEAD_SOURCES as readonly string[]} placeholder="Select source…" />
            </Field>
            <Field label="Lead From">
              <SelectInput value={f.lead_from} onChange={v => set('lead_from', v)} options={LEAD_FROM} placeholder="Select…" />
            </Field>
            <Field label="Data Source">
              <TextInput value={f.data_source} onChange={v => set('data_source', v)} list="datasource-suggest" placeholder="e.g. Apollo, Website…" />
            </Field>
            <Field label="Customer Type">
              <TextInput value={f.customer_type} onChange={v => set('customer_type', v)} placeholder="NBNC / NBEC…" />
            </Field>
          </Section>

          {category && (
            <div className="flex items-center gap-2 text-sm bg-slate-50 rounded-xl px-4 py-3 ring-1 ring-slate-100">
              <span className="text-slate-500">Funnel classification</span>
              <span className={`inline-flex items-center gap-1.5 font-bold rounded-full px-2.5 py-1 ring-1 ${CATEGORY_STYLES[category].badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLES[category].dot}`} />
                {category}
              </span>
            </div>
          )}

          <Section title="Pipeline & Ownership">
            <Field label="Lead Stage">
              <SelectInput value={f.lead_stage} onChange={v => set('lead_stage', v)} options={LEAD_STAGES} />
            </Field>
            <Field label="Lead Status (MQL/SQL)">
              <SelectInput value={f.lead_status} onChange={setStatus} options={LEAD_STATUSES} placeholder="Auto from source…" />
            </Field>
            <Field label="Assigned To">
              <TextInput value={f.assigned_to} onChange={v => set('assigned_to', v)} list="assignee-suggest" placeholder="Name…" />
            </Field>
            <Field label="Became SQL Date"><TextInput type="date" value={f.became_sql_date} onChange={v => set('became_sql_date', v)} /></Field>
          </Section>

          <Section title="Closed Deal — seats & revenue">
            <Field label="Hours Booked">
              <TextInput type="number" value={f.closed_hours} onChange={v => set('closed_hours', v)} placeholder="e.g. 160" />
            </Field>
            <Field label="Seats (auto = hrs ÷ 160)">
              <div className="h-9 flex items-center px-2.5 rounded-md bg-slate-50 ring-1 ring-slate-100 text-sm font-bold text-indigo-700">
                {f.closed_hours.trim() ? `${formatSeats(hoursToSeats(Number(f.closed_hours)))} seat(s)` : '—'}
              </div>
            </Field>
            <Field label="MRR (USD / mo)">
              <TextInput type="number" value={f.mrr_value} onChange={v => set('mrr_value', v)} placeholder="monthly $" />
            </Field>
            <Field label="One-time Revenue (USD)">
              <TextInput type="number" value={f.one_time_revenue} onChange={v => set('one_time_revenue', v)} placeholder="one-time $" />
            </Field>
            <Field label="Closed Date">
              <TextInput type="date" value={f.closed_date} onChange={v => set('closed_date', v)} />
            </Field>
          </Section>

          {(f.closed_hours.trim() || f.mrr_value.trim() || f.one_time_revenue.trim()) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm bg-emerald-50/60 rounded-xl px-4 py-3 ring-1 ring-emerald-100">
              <span className="text-slate-500">Deal summary</span>
              <span className="font-bold text-emerald-700">{formatSeats(hoursToSeats(Number(f.closed_hours) || 0))} seats</span>
              <span className="font-bold text-emerald-700">ACV {formatUSD(annualContractValue(Number(f.mrr_value) || 0, Number(f.one_time_revenue) || 0))}</span>
              {f.lead_stage !== CLOSED_WON_STAGE && (
                <span className="text-[11px] font-semibold text-amber-600">⚠ Counts in stats only when Stage = “Closed Won”</span>
              )}
            </div>
          )}

          <Field label="Comment" full>
            <Textarea value={f.comment} onChange={e => set('comment', e.target.value)} rows={2}
              className="border-slate-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 resize-none text-sm" />
          </Field>

          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <Button variant="ghost" onClick={onClose} className="text-slate-500">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={`gap-1.5 font-bold rounded-xl border-0 text-white min-w-[140px] ${saved ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500'}`}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : saved ? <><Check className="h-4 w-4" /> Saved</>
              : isEdit ? <><Check className="h-4 w-4" /> Save Changes</> : <><Plus className="h-4 w-4" /> Save Lead</>}
          </Button>
        </div>
      </div>

      <datalist id="datasource-suggest">{dataSourceSuggestions.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="industry-suggest">{industrySuggestions.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="service-suggest">{serviceSuggestions.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="assignee-suggest">{assigneeSuggestions.map(s => <option key={s} value={s} />)}</datalist>
    </div>,
    document.body
  )
}

/* ── field primitives ─────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">{title}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}
function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? 'col-span-2 md:col-span-4' : ''}`}>
      <Label className="text-xs font-semibold text-slate-600">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</Label>
      {children}
    </div>
  )
}
function TextInput({ value, onChange, type = 'text', placeholder, list }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; list?: string }) {
  return (
    <Input type={type} value={value} placeholder={placeholder} list={list}
      onChange={e => onChange(e.target.value)}
      className="h-9 text-sm border-slate-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400" />
  )
}
function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="h-9 w-full text-sm rounded-md border border-slate-200 bg-white px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-slate-700">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
