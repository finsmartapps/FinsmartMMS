'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Loader2, AlertTriangle, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getViewer, fmtDate } from '@/lib/account-pursuit/helpers'
import { StatusBadge, TierBadge } from '@/components/account-pursuit/badges'
import type { AbmAccount, AbmContact } from '@/lib/account-pursuit/types'

const STALL_DAYS = 14
const ACTIVE_STATUSES = new Set(['engaged', 'in_conversation', 'opportunity'])

type OwnerRow = {
  ownerId: string
  name: string
  accounts: number
  active: number
  won: number
  contacts: number
  requested: number
  accepted: number
  replied: number
  meetings: number
}

export default function RollupPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AbmAccount[]>([])
  const [contacts, setContacts] = useState<AbmContact[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    const viewer = await getViewer()
    if (!viewer?.isManager) { setAllowed(false); router.replace('/account-pursuit'); return }
    setAllowed(true)
    const supabase = createClient()
    const [{ data: accts }, { data: cts }, { data: profs }] = await Promise.all([
      supabase.from('abm_accounts').select('*'),
      supabase.from('abm_contacts').select('*'),
      supabase.from('profiles').select('id, name'),
    ])
    setAccounts((accts as AbmAccount[]) ?? [])
    setContacts((cts as AbmContact[]) ?? [])
    const nm: Record<string, string> = {}
    for (const p of (profs ?? []) as { id: string; name: string }[]) nm[p.id] = p.name
    setNames(nm)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const { owners, totals, stalled } = useMemo(() => {
    const map = new Map<string, OwnerRow>()
    const row = (id: string | null): OwnerRow => {
      const key = id ?? 'unassigned'
      if (!map.has(key)) map.set(key, { ownerId: key, name: id ? (names[id] ?? 'Unknown') : 'Unassigned', accounts: 0, active: 0, won: 0, contacts: 0, requested: 0, accepted: 0, replied: 0, meetings: 0 })
      return map.get(key)!
    }
    for (const a of accounts) {
      const r = row(a.owner_id)
      r.accounts++
      if (ACTIVE_STATUSES.has(a.status)) r.active++
      if (a.status === 'won') r.won++
    }
    for (const c of contacts) {
      const r = row(c.owner_id)
      r.contacts++
      if (['request_sent', 'accepted', 'no_response', 'declined'].includes(c.connection_status)) r.requested++
      if (c.connection_status === 'accepted') r.accepted++
      if (['replied', 'in_conversation', 'meeting_booked'].includes(c.conversation_stage)) r.replied++
      if (c.conversation_stage === 'meeting_booked') r.meetings++
    }
    const owners = [...map.values()].sort((a, b) => b.accounts - a.accounts)
    const totals = owners.reduce((t, o) => ({
      accounts: t.accounts + o.accounts, contacts: t.contacts + o.contacts,
      requested: t.requested + o.requested, accepted: t.accepted + o.accepted,
      replied: t.replied + o.replied, meetings: t.meetings + o.meetings,
    }), { accounts: 0, contacts: 0, requested: 0, accepted: 0, replied: 0, meetings: 0 })

    const cutoff = Date.now() - STALL_DAYS * 86400000
    const stalled = accounts.filter(a => ACTIVE_STATUSES.has(a.status) &&
      (!a.last_activity_at || new Date(a.last_activity_at).getTime() < cutoff))
      .sort((a, b) => (a.last_activity_at ?? '').localeCompare(b.last_activity_at ?? ''))
    return { owners, totals, stalled }
  }, [accounts, contacts, names])

  const pct = (n: number, d: number) => d === 0 ? '—' : `${Math.round((n / d) * 100)}%`

  if (allowed === false) return null
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin text-teal-600" /></div>

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
          <BarChart3 size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-[19px] font-bold text-[#1D1D1F] leading-tight">Team Roll-up</h1>
          <p className="text-[12px] text-[#6E6E73]">Pursuit activity and funnel across the team</p>
        </div>
      </div>

      {/* Funnel totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Accounts" value={totals.accounts} />
        <Stat label="Contacts" value={totals.contacts} />
        <Stat label="Requested" value={totals.requested} />
        <Stat label="Accepted" value={totals.accepted} sub={pct(totals.accepted, totals.requested)} />
        <Stat label="Replied" value={totals.replied} sub={pct(totals.replied, totals.accepted)} />
        <Stat label="Meetings" value={totals.meetings} />
      </div>

      {/* Per-owner table */}
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={15} className="text-teal-600" />
        <h2 className="text-[14px] font-semibold text-[#1D1D1F]">By owner</h2>
      </div>
      <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden mb-8 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[#F2F2F7] text-left">
              {['Owner', 'Accounts', 'Active', 'Won', 'Contacts', 'Accept %', 'Reply %', 'Meetings'].map(h => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F2F7]">
            {owners.map(o => (
              <tr key={o.ownerId}>
                <td className="px-4 py-3 text-[13px] font-semibold text-[#1D1D1F]">{o.name}</td>
                <td className="px-4 py-3 text-[13px] text-[#1D1D1F]">{o.accounts}</td>
                <td className="px-4 py-3 text-[13px] text-[#1D1D1F]">{o.active}</td>
                <td className="px-4 py-3 text-[13px] text-emerald-700 font-medium">{o.won}</td>
                <td className="px-4 py-3 text-[13px] text-[#1D1D1F]">{o.contacts}</td>
                <td className="px-4 py-3 text-[13px] text-[#1D1D1F]">{pct(o.accepted, o.requested)}</td>
                <td className="px-4 py-3 text-[13px] text-[#1D1D1F]">{pct(o.replied, o.accepted)}</td>
                <td className="px-4 py-3 text-[13px] text-[#1D1D1F]">{o.meetings}</td>
              </tr>
            ))}
            {owners.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[12px] text-[#AEAEB2]">No pursuit data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Stalled accounts */}
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={15} className="text-amber-500" />
        <h2 className="text-[14px] font-semibold text-[#1D1D1F]">Stalled accounts</h2>
        <span className="text-[11px] text-[#AEAEB2]">(active, no activity in {STALL_DAYS}d) · {stalled.length}</span>
      </div>
      {stalled.length === 0 ? (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl py-10 text-center text-[12px] text-[#AEAEB2]">Nothing stalled — every active account has recent activity.</div>
      ) : (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden divide-y divide-[#F2F2F7]">
          {stalled.slice(0, 25).map(a => (
            <div key={a.id} onClick={() => router.push(`/account-pursuit/accounts/${a.id}`)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] cursor-pointer transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#1D1D1F]">{a.name}</span>
                  <TierBadge value={a.tier} />
                </div>
                <p className="text-[11px] text-[#AEAEB2] mt-0.5">Owner: {a.owner_id ? (names[a.owner_id] ?? 'Unknown') : 'Unassigned'}</p>
              </div>
              <StatusBadge value={a.status} />
              <span className="text-[11px] text-amber-600 w-28 text-right">
                {a.last_activity_at ? `last ${fmtDate(a.last_activity_at)}` : 'no activity'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl px-3 py-3 text-center">
      <div className="text-[20px] font-bold text-[#1D1D1F]">{value}</div>
      {sub && <div className="text-[11px] font-medium text-teal-600">{sub}</div>}
      <div className="text-[10px] text-[#AEAEB2] uppercase tracking-wider">{label}</div>
    </div>
  )
}
