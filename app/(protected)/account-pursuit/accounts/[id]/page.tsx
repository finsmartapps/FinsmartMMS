'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Plus, X, Save, ExternalLink, Users, Pencil, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getViewer, fmtDate, dueLabel, fullName, guessRole } from '@/lib/account-pursuit/helpers'
import { ACCOUNT_STATUSES, TIERS, COMMITTEE_ROLES } from '@/lib/account-pursuit/constants'
import { StatusBadge, TierBadge, RoleBadge, ConnectionBadge, StageBadge } from '@/components/account-pursuit/badges'
import type { AbmAccount, AbmContact, AccountStatus, Tier, CommitteeRole } from '@/lib/account-pursuit/types'

const input = 'w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] text-[#1D1D1F] focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 transition bg-white'
const label = 'text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block'

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [account, setAccount] = useState<AbmAccount | null>(null)
  const [contacts, setContacts] = useState<AbmContact[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<{ id: string; isManager: boolean } | null>(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: acct, error }, { data: cts }] = await Promise.all([
      supabase.from('abm_accounts').select('*').eq('id', id).single(),
      supabase.from('abm_contacts').select('*').eq('account_id', id).order('committee_role').order('first_name'),
    ])
    if (error || !acct) { router.push('/account-pursuit/accounts'); return }
    setAccount(acct as AbmAccount)
    setContacts((cts as AbmContact[]) ?? [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { getViewer().then(setViewer); load() }, [load])

  async function patch(fields: Partial<AbmAccount>) {
    if (!account) return
    setAccount({ ...account, ...fields })
    const supabase = createClient()
    await supabase.from('abm_accounts').update(fields).eq('id', account.id)
  }

  async function changeStatus(status: AccountStatus) {
    const now = new Date().toISOString()
    await patch({ status, stage_changed_at: now, last_activity_at: now,
      ...(status === 'won' || status === 'lost' ? { closed_at: now } : {}) })
  }

  if (loading || !account) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin text-teal-600" /></div>
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/account-pursuit/accounts" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] hover:text-teal-700 transition mb-4">
        <ArrowLeft size={14} /> Accounts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-bold text-[#1D1D1F] leading-tight">{account.name}</h1>
            <TierBadge value={account.tier} />
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#6E6E73] mt-1 flex-wrap">
            {account.industry && <span>{account.industry}</span>}
            {account.targeted_industry && <span>· angle: {account.targeted_industry}</span>}
            {account.revenue_text && <span>· {account.revenue_text}</span>}
            {account.employee_size && <span>· {account.employee_size} emp</span>}
            {(account.state || account.country) && <span>· {[account.state, account.country].filter(Boolean).join(', ')}</span>}
            {account.website && <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-600 hover:underline">website <ExternalLink size={10} /></a>}
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] border border-[#E5E5EA] rounded-lg px-3 py-1.5 hover:border-[#D1D1D6] transition flex-shrink-0">
          <Pencil size={12} /> Edit
        </button>
      </div>

      {/* Status + tier quick controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={label + ' !mb-0'}>Status</span>
          <select value={account.status} onChange={e => changeStatus(e.target.value as AccountStatus)}
            className="h-8 border border-[#E5E5EA] rounded-lg px-2 text-[12px] bg-white text-[#1D1D1F]">
            {ACCOUNT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className={label + ' !mb-0'}>Tier</span>
          <select value={account.tier ?? ''} onChange={e => patch({ tier: (e.target.value || null) as Tier | null })}
            className="h-8 border border-[#E5E5EA] rounded-lg px-2 text-[12px] bg-white text-[#1D1D1F]">
            <option value="">—</option>
            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Strategy cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { k: 'Compelling event', v: account.compelling_event },
          { k: 'Pain hypothesis', v: account.pain_hypothesis },
          { k: 'Account next step', v: account.next_action ? `${account.next_action}${account.next_action_date ? ` (${fmtDate(account.next_action_date)})` : ''}` : null },
        ].map(({ k, v }) => (
          <div key={k} className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">{k}</p>
            <p className="text-[12px] text-[#1D1D1F] leading-relaxed">{v ?? <span className="text-[#AEAEB2]">—</span>}</p>
          </div>
        ))}
      </div>

      {/* Warm connections — existing network at this firm */}
      {account.warm_connection_count > 0 && (
        <div className="bg-white border border-teal-200 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[15px]">🤝</span>
            <h2 className="text-[14px] font-semibold text-[#1D1D1F]">You already know {account.warm_connection_count} {account.warm_connection_count === 1 ? 'person' : 'people'} here</h2>
          </div>
          <p className="text-[11px] text-[#6E6E73] mb-3">Warm intro paths from your LinkedIn network — ask one of them to introduce you to the committee.</p>
          <div className="flex flex-wrap gap-2">
            {account.warm_connections.map((w, i) => (
              <a key={i} href={w.url || undefined} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 hover:bg-teal-100 transition">
                <span className="font-medium text-[#1D1D1F]">{`${w.first_name} ${w.last_name}`.trim()}</span>
                {w.position && <span className="text-[#6E6E73]">· {w.position}</span>}
                {w.url && <ExternalLink size={10} className="text-teal-600" />}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Committee contacts */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-teal-600" />
          <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Committee ({contacts.length})</h2>
        </div>
        <button onClick={() => setShowAddContact(true)}
          className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition">
          <Plus size={14} /> Add contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl py-12 text-center">
          <Users size={22} className="text-[#AEAEB2] mx-auto mb-2" />
          <p className="text-[13px] text-[#AEAEB2]">No contacts yet. Add the decision-makers you want to reach.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden divide-y divide-[#F2F2F7]">
          {contacts.map(c => {
            const due = dueLabel(c.next_action_date)
            return (
              <div key={c.id} onClick={() => router.push(`/account-pursuit/contacts/${c.id}`)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[#FAFAFA] cursor-pointer transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#1D1D1F]">{fullName(c)}</span>
                    <RoleBadge value={c.committee_role} />
                    {c.has_mutuals && <span className="text-[10px] text-emerald-600 font-medium">warm</span>}
                  </div>
                  {c.job_title && <p className="text-[11px] text-[#AEAEB2] mt-0.5 truncate">{c.job_title}</p>}
                </div>
                <ConnectionBadge value={c.connection_status} />
                <StageBadge value={c.conversation_stage} />
                <div className="w-32 text-right">
                  {c.next_action
                    ? <span className={`text-[11px] ${due.tone === 'overdue' ? 'text-rose-600 font-medium' : due.tone === 'today' ? 'text-amber-600 font-medium' : 'text-[#AEAEB2]'}`}>{due.text}</span>
                    : <span className="text-[11px] text-[#AEAEB2]">no next step</span>}
                </div>
                <ChevronRight size={15} className="text-[#D1D1D6] flex-shrink-0" />
              </div>
            )
          })}
        </div>
      )}

      {showAddContact && viewer && (
        <AddContactModal accountId={account.id} ownerId={account.owner_id ?? viewer.id} viewerId={viewer.id}
          onClose={() => setShowAddContact(false)} onCreated={() => { setShowAddContact(false); load() }} />
      )}
      {editing && (
        <EditAccountModal account={account}
          onClose={() => setEditing(false)}
          onSaved={fields => { patch(fields); setEditing(false) }} />
      )}
    </div>
  )
}

function AddContactModal({ accountId, ownerId, viewerId, onClose, onCreated }: {
  accountId: string; ownerId: string; viewerId: string; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', job_title: '', committee_role: 'unknown' as CommitteeRole,
    linkedin_url: '', email: '', direct_number: '', mutual_connections: '',
  })
  const [roleTouched, setRoleTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    setSaving(true); setError('')
    const mutual = form.mutual_connections.trim()
    const hasMutuals = !!mutual && !/^(no( known)? mutuals|none|-|shows page)/i.test(mutual)
    const supabase = createClient()
    const { error: e } = await supabase.from('abm_contacts').insert({
      account_id: accountId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      job_title: form.job_title.trim() || null,
      committee_role: form.committee_role,
      linkedin_url: form.linkedin_url.trim() || null,
      email: form.email.trim() || null,
      direct_number: form.direct_number.trim() || null,
      mutual_connections: mutual || null,
      has_mutuals: hasMutuals,
      owner_id: ownerId,
      created_by: viewerId,
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    onCreated()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA] max-h-[85vh] flex flex-col">
          <div className="px-6 py-4 border-b border-[#F2F2F7] flex items-center justify-between">
            <p className="text-[15px] font-semibold text-[#1D1D1F]">Add committee contact</p>
            <button onClick={onClose} className="text-[#AEAEB2] hover:text-[#1D1D1F]"><X size={17} /></button>
          </div>
          <div className="px-6 py-5 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>First name *</label><input className={input} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
              <div><label className={label}>Last name</label><input className={input} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
            </div>
            <div>
              <label className={label}>Job title</label>
              <input className={input} value={form.job_title}
                onChange={e => { set('job_title', e.target.value); if (!roleTouched) setForm(f => ({ ...f, committee_role: guessRole(e.target.value) })) }} />
            </div>
            <div>
              <label className={label}>Committee role</label>
              <select className={input} value={form.committee_role} onChange={e => { setRoleTouched(true); set('committee_role', e.target.value) }}>
                {COMMITTEE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div><label className={label}>LinkedIn URL</label><input className={input} value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Email</label><input className={input} value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div><label className={label}>Phone</label><input className={input} value={form.direct_number} onChange={e => set('direct_number', e.target.value)} /></div>
            </div>
            <div>
              <label className={label}>Mutual connections (warm path)</label>
              <input className={input} value={form.mutual_connections} onChange={e => set('mutual_connections', e.target.value)} placeholder="e.g. 3 mutuals via John" />
            </div>
            {error && <p className="text-[12px] text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-[#F2F2F7] flex items-center justify-end gap-3">
            <button onClick={onClose} className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Add
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function EditAccountModal({ account, onClose, onSaved }: {
  account: AbmAccount; onClose: () => void; onSaved: (fields: Partial<AbmAccount>) => void
}) {
  const [form, setForm] = useState({
    targeted_industry: account.targeted_industry ?? '',
    compelling_event: account.compelling_event ?? '',
    pain_hypothesis: account.pain_hypothesis ?? '',
    associations: account.associations ?? '',
    software_partnerships: account.software_partnerships ?? '',
    offshore_presence: account.offshore_presence ?? '',
    next_action: account.next_action ?? '',
    next_action_date: account.next_action_date ?? '',
    notes: account.notes ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E5EA] max-h-[85vh] flex flex-col">
          <div className="px-6 py-4 border-b border-[#F2F2F7] flex items-center justify-between">
            <p className="text-[15px] font-semibold text-[#1D1D1F]">Edit account</p>
            <button onClick={onClose} className="text-[#AEAEB2] hover:text-[#1D1D1F]"><X size={17} /></button>
          </div>
          <div className="px-6 py-5 space-y-3 overflow-y-auto">
            <div><label className={label}>Targeted industry (angle)</label><input className={input} value={form.targeted_industry} onChange={e => set('targeted_industry', e.target.value)} /></div>
            <div><label className={label}>Compelling event (why now)</label><input className={input} value={form.compelling_event} onChange={e => set('compelling_event', e.target.value)} /></div>
            <div><label className={label}>Pain hypothesis</label><input className={input} value={form.pain_hypothesis} onChange={e => set('pain_hypothesis', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Account next step</label><input className={input} value={form.next_action} onChange={e => set('next_action', e.target.value)} /></div>
              <div><label className={label}>Next step date</label><input type="date" className={input} value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} /></div>
            </div>
            <div><label className={label}>Associations</label><input className={input} value={form.associations} onChange={e => set('associations', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Software partnerships</label><input className={input} value={form.software_partnerships} onChange={e => set('software_partnerships', e.target.value)} /></div>
              <div><label className={label}>Offshore presence</label><input className={input} value={form.offshore_presence} onChange={e => set('offshore_presence', e.target.value)} /></div>
            </div>
            <div><label className={label}>Notes</label><textarea className={`${input} resize-none`} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className="px-6 py-4 border-t border-[#F2F2F7] flex items-center justify-end gap-3">
            <button onClick={onClose} className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">Cancel</button>
            <button onClick={() => onSaved({
              targeted_industry: form.targeted_industry.trim() || null,
              compelling_event: form.compelling_event.trim() || null,
              pain_hypothesis: form.pain_hypothesis.trim() || null,
              associations: form.associations.trim() || null,
              software_partnerships: form.software_partnerships.trim() || null,
              offshore_presence: form.offshore_presence.trim() || null,
              next_action: form.next_action.trim() || null,
              next_action_date: form.next_action_date || null,
              notes: form.notes.trim() || null,
            })}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition">
              <Save size={14} /> Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
