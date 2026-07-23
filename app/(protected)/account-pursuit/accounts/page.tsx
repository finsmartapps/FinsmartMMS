'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Target, Search, Building2, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getViewer, parseRevenue, autoTier, fmtDate, dueLabel } from '@/lib/account-pursuit/helpers'
import { ACCOUNT_STATUSES, TIERS } from '@/lib/account-pursuit/constants'
import { StatusBadge, TierBadge } from '@/components/account-pursuit/badges'
import type { AbmAccount, Tier, AccountStatus } from '@/lib/account-pursuit/types'

const input = 'w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] text-[#1D1D1F] focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 transition bg-white'
const label = 'text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block'

export default function AccountsBoardPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AbmAccount[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<{ id: string; isManager: boolean } | null>(null)

  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<'all' | Tier>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all')
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: accts }, { data: contacts }] = await Promise.all([
      supabase.from('abm_accounts').select('*').order('tier', { ascending: true }).order('name'),
      supabase.from('abm_contacts').select('id, account_id'),
    ])
    setAccounts((accts as AbmAccount[]) ?? [])
    const c: Record<string, number> = {}
    for (const row of (contacts ?? []) as { account_id: string }[]) c[row.account_id] = (c[row.account_id] ?? 0) + 1
    setCounts(c)
    setLoading(false)
  }, [])

  useEffect(() => { getViewer().then(setViewer); load() }, [load])

  const filtered = useMemo(() => accounts.filter(a => {
    if (tierFilter !== 'all' && a.tier !== tierFilter) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (search.trim() && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [accounts, tierFilter, statusFilter, search])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
            <Target size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-[#1D1D1F] leading-tight">Target Accounts</h1>
            <p className="text-[12px] text-[#6E6E73]">{accounts.length} accounts in your pursuit list</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition">
          <Plus size={15} /> New Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
            className="w-full pl-8 pr-3 h-9 border border-[#E5E5EA] rounded-lg text-[13px] focus:outline-none focus:border-teal-500 bg-white" />
        </div>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value as 'all' | Tier)}
          className="h-9 border border-[#E5E5EA] rounded-lg px-2.5 text-[12px] bg-white text-[#1D1D1F]">
          <option value="all">All tiers</option>
          {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | AccountStatus)}
          className="h-9 border border-[#E5E5EA] rounded-lg px-2.5 text-[12px] bg-white text-[#1D1D1F]">
          <option value="all">All statuses</option>
          {ACCOUNT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin text-teal-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl py-16 text-center">
          <Building2 size={26} className="text-[#AEAEB2] mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-[#1D1D1F]">{accounts.length === 0 ? 'No accounts yet' : 'No matches'}</p>
          <p className="text-[12px] text-[#AEAEB2] mt-1">{accounts.length === 0 ? 'Add your first target account, or import your aggregator list.' : 'Adjust the filters above.'}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F2F2F7] text-left">
                {['Account', 'Tier', 'Status', 'Contacts', 'Next action'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">
              {filtered.map(a => {
                const due = dueLabel(a.next_action_date)
                return (
                  <tr key={a.id} onClick={() => router.push(`/account-pursuit/accounts/${a.id}`)}
                    className="hover:bg-[#FAFAFA] cursor-pointer transition">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[#1D1D1F]">{a.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-[#AEAEB2] mt-0.5">
                        {a.targeted_industry && <span>{a.targeted_industry}</span>}
                        {a.revenue_text && <span>· {a.revenue_text}</span>}
                        {a.state && <span>· {a.state}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><TierBadge value={a.tier} /></td>
                    <td className="px-4 py-3"><StatusBadge value={a.status} /></td>
                    <td className="px-4 py-3 text-[13px] text-[#1D1D1F]">{counts[a.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      {a.next_action
                        ? <div>
                            <div className="text-[12px] text-[#1D1D1F] truncate max-w-[220px]">{a.next_action}</div>
                            <div className={`text-[11px] ${due.tone === 'overdue' ? 'text-rose-600 font-medium' : due.tone === 'today' ? 'text-amber-600 font-medium' : 'text-[#AEAEB2]'}`}>{fmtDate(a.next_action_date)} · {due.text}</div>
                          </div>
                        : <span className="text-[12px] text-[#AEAEB2]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && viewer && (
        <AddAccountModal viewerId={viewer.id} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />
      )}
    </div>
  )
}

function AddAccountModal({ viewerId, onClose, onCreated }: { viewerId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', website: '', industry: '', targeted_industry: '', revenue_text: '',
    employee_size: '', state: '', country: '', tier: '' as '' | Tier, status: 'target' as AccountStatus,
    compelling_event: '', pain_hypothesis: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) { setError('Account name is required.'); return }
    setSaving(true); setError('')
    const revenue_usd = parseRevenue(form.revenue_text)
    const employees = form.employee_size ? parseInt(form.employee_size, 10) : null
    const tier = form.tier || autoTier(revenue_usd, employees)
    const supabase = createClient()
    const { error: e } = await supabase.from('abm_accounts').insert({
      name: form.name.trim(),
      website: form.website.trim() || null,
      industry: form.industry.trim() || null,
      targeted_industry: form.targeted_industry.trim() || null,
      revenue_text: form.revenue_text.trim() || null,
      revenue_usd,
      employee_size: employees,
      tier,
      status: form.status,
      state: form.state.trim() || null,
      country: form.country.trim() || null,
      compelling_event: form.compelling_event.trim() || null,
      pain_hypothesis: form.pain_hypothesis.trim() || null,
      notes: form.notes.trim() || null,
      owner_id: viewerId,
      created_by: viewerId,
      source: 'manual',
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    onCreated()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E5EA] max-h-[85vh] flex flex-col">
          <div className="px-6 py-4 border-b border-[#F2F2F7] flex items-center justify-between">
            <p className="text-[15px] font-semibold text-[#1D1D1F]">New Target Account</p>
            <button onClick={onClose} className="text-[#AEAEB2] hover:text-[#1D1D1F]"><X size={17} /></button>
          </div>
          <div className="px-6 py-5 space-y-3 overflow-y-auto">
            <div>
              <label className={label}>Account name *</label>
              <input className={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. LBMC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Website</label><input className={input} value={form.website} onChange={e => set('website', e.target.value)} /></div>
              <div><label className={label}>Targeted industry</label><input className={input} value={form.targeted_industry} onChange={e => set('targeted_industry', e.target.value)} placeholder="e.g. Restaurant" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={label}>Revenue</label><input className={input} value={form.revenue_text} onChange={e => set('revenue_text', e.target.value)} placeholder="$10.6M" /></div>
              <div><label className={label}>Employees</label><input className={input} value={form.employee_size} onChange={e => set('employee_size', e.target.value)} placeholder="500" /></div>
              <div>
                <label className={label}>Tier (auto)</label>
                <select className={input} value={form.tier} onChange={e => set('tier', e.target.value)}>
                  <option value="">Auto</option>
                  {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>State</label><input className={input} value={form.state} onChange={e => set('state', e.target.value)} /></div>
              <div><label className={label}>Country</label><input className={input} value={form.country} onChange={e => set('country', e.target.value)} /></div>
            </div>
            <div>
              <label className={label}>Compelling event (why now)</label>
              <input className={input} value={form.compelling_event} onChange={e => set('compelling_event', e.target.value)} placeholder="e.g. hiring push, busy-season capacity" />
            </div>
            <div>
              <label className={label}>Pain hypothesis</label>
              <input className={input} value={form.pain_hypothesis} onChange={e => set('pain_hypothesis', e.target.value)} placeholder="What problem do we think they have?" />
            </div>
            <div>
              <label className={label}>Notes</label>
              <textarea className={`${input} resize-none`} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            {error && <p className="text-[12px] text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-[#F2F2F7] flex items-center justify-end gap-3">
            <button onClick={onClose} className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
