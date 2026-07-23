'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  Clock, Loader2, ExternalLink, CheckCircle2, XCircle, MinusCircle, Upload, RefreshCw, Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todayISO, businessDaysFromToday, fmtDate, fullName } from '@/lib/account-pursuit/helpers'
import { parseConnectionRows, normalizeLinkedinUrl, nameCompanyKey, normCompany } from '@/lib/account-pursuit/connections'
import type { AbmContact, ConnectionStatus, WarmConnection } from '@/lib/account-pursuit/types'

type Row = AbmContact & { account: { name: string } | null }
type SyncResult = { flipped: number; alreadyAccepted: number; unmatched: number; scanned: number; warmFirms: number; warmPeople: number }

export default function AwaitingPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('abm_contacts')
      .select('*, account:abm_accounts(name)')
      .eq('connection_status', 'request_sent')
      .order('request_sent_at', { ascending: true, nullsFirst: false })
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function acceptContact(id: string, connectedAt: string, hasNextAction: boolean) {
    const supabase = createClient()
    const fields: Partial<AbmContact> = { connection_status: 'accepted', connected_at: connectedAt }
    if (!hasNextAction) { fields.next_action = 'Send opener message'; fields.next_action_date = businessDaysFromToday(1) }
    await supabase.from('abm_contacts').update(fields).eq('id', id)
  }

  async function mark(r: Row, status: ConnectionStatus) {
    setBusyId(r.id)
    if (status === 'accepted') {
      await acceptContact(r.id, new Date().toISOString(), !!r.next_action)
    } else {
      const supabase = createClient()
      await supabase.from('abm_contacts').update({ connection_status: status }).eq('id', r.id)
    }
    setRows(prev => prev.filter(x => x.id !== r.id))
    setBusyId(null)
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSyncing(true); setSyncResult(null); setSyncError('')
    try {
      const buf = await file.arrayBuffer()
      const book = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const ws = book.Sheets[book.SheetNames[0]]
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: false })
      const { rows: conns, error } = parseConnectionRows(grid)
      if (error) { setSyncError(error); setSyncing(false); e.target.value = ''; return }

      const supabase = createClient()
      // Load all my contacts to match against (URL first, then name+company)
      const { data: all } = await supabase
        .from('abm_contacts')
        .select('id, first_name, last_name, linkedin_url, connection_status, next_action, account:abm_accounts(name)')
      const byUrl = new Map<string, { id: string; status: string; hasNext: boolean }>()
      const byName = new Map<string, { id: string; status: string; hasNext: boolean }>()
      type MatchRow = { id: string; first_name: string; last_name: string | null; linkedin_url: string | null; connection_status: string; next_action: string | null; account: { name: string } | null }
      for (const c of (all ?? []) as unknown as MatchRow[]) {
        const rec = { id: c.id, status: c.connection_status, hasNext: !!c.next_action }
        const nu = normalizeLinkedinUrl(c.linkedin_url)
        if (nu) byUrl.set(nu, rec)
        const key = nameCompanyKey(c.first_name, c.last_name ?? '', c.account?.name ?? '')
        byName.set(key, rec)
      }

      let flipped = 0, alreadyAccepted = 0, unmatched = 0
      const toAccept: { id: string; date: string; hasNext: boolean }[] = []
      for (const conn of conns) {
        const nu = normalizeLinkedinUrl(conn.url)
        const match = (nu && byUrl.get(nu)) || byName.get(nameCompanyKey(conn.first, conn.last, conn.company))
        if (!match) { unmatched++; continue }
        if (match.status === 'accepted') { alreadyAccepted++; continue }
        toAccept.push({ id: match.id, date: conn.connectedOn ?? todayISO(), hasNext: match.hasNext })
      }

      for (let i = 0; i < toAccept.length; i += 20) {
        await Promise.all(toAccept.slice(i, i + 20).map(t =>
          acceptContact(t.id, new Date(t.date).toISOString(), t.hasNext)))
        flipped += Math.min(20, toAccept.length - i)
      }

      // Warm connections: company-match every connection to target accounts.
      const { data: accts } = await supabase.from('abm_accounts').select('id, name')
      const acctNorms = (accts ?? []).map(a => ({ id: a.id as string, norm: normCompany(a.name) })).filter(a => a.norm.length >= 3)
      const warmByAccount = new Map<string, WarmConnection[]>()
      for (const conn of conns) {
        const cn = normCompany(conn.company)
        if (cn.length < 3) continue
        const hit = acctNorms.find(a => a.norm === cn || a.norm.includes(cn) || cn.includes(a.norm))
        if (!hit) continue
        if (!warmByAccount.has(hit.id)) warmByAccount.set(hit.id, [])
        warmByAccount.get(hit.id)!.push({ first_name: conn.first, last_name: conn.last, position: conn.position, url: conn.url })
      }
      // Overwrite each matched account's warm list (so re-upload refreshes cleanly).
      let warmPeople = 0
      for (const [accountId, people] of warmByAccount) {
        warmPeople += people.length
        await supabase.from('abm_accounts').update({ warm_connections: people, warm_connection_count: people.length }).eq('id', accountId)
      }

      setSyncResult({ flipped, alreadyAccepted, unmatched, scanned: conns.length, warmFirms: warmByAccount.size, warmPeople })
      await load()
    } catch {
      setSyncError('Could not read that file. Export "Connections" from LinkedIn and upload the .csv.')
    }
    setSyncing(false)
    e.target.value = ''
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
          <Clock size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-[19px] font-bold text-[#1D1D1F] leading-tight">Awaiting Acceptance</h1>
          <p className="text-[12px] text-[#6E6E73]">{loading ? 'Loading…' : `${rows.length} connection request${rows.length === 1 ? '' : 's'} pending`}</p>
        </div>
      </div>

      {/* Connections sync */}
      <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <RefreshCw size={15} className="text-teal-600" />
          <p className="text-[13px] font-semibold text-[#1D1D1F]">Sync LinkedIn Connections</p>
        </div>
        <p className="text-[12px] text-[#6E6E73] leading-relaxed mb-3">
          Export <b>Connections</b> from LinkedIn (Settings → Data Privacy → Get a copy of your data → Connections),
          then upload the CSV here. Anyone who accepted flips to <b>Accepted</b> automatically and gets an opener queued.
        </p>
        <label className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 cursor-pointer transition">
          <input type="file" accept=".csv" className="hidden" onChange={onCsv} disabled={syncing} />
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {syncing ? 'Matching…' : 'Upload Connections.csv'}
        </label>
        {syncError && <p className="text-[12px] text-rose-600 bg-rose-50 px-3 py-2 rounded-lg mt-3">{syncError}</p>}
        {syncResult && (
          <div className="mt-3 space-y-1.5">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#1D1D1F]">
              <span className="text-[#6E6E73]">Scanned {syncResult.scanned.toLocaleString()} connections</span>
              <span className="text-emerald-700 font-medium">✓ {syncResult.flipped} flipped to accepted</span>
              <span className="text-[#6E6E73]">{syncResult.alreadyAccepted} already accepted</span>
            </div>
            {syncResult.warmPeople > 0 && (
              <div className="text-[12px] text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                🤝 Found <b>{syncResult.warmPeople}</b> warm connection{syncResult.warmPeople === 1 ? '' : 's'} across <b>{syncResult.warmFirms}</b> target firm{syncResult.warmFirms === 1 ? '' : 's'} — see the “warm” badge on those accounts for intro paths.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending list */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={22} className="animate-spin text-teal-600" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl py-14 text-center">
          <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-[#1D1D1F]">No pending requests</p>
          <p className="text-[12px] text-[#AEAEB2] mt-1">When you mark a contact&apos;s connection as &quot;request sent&quot;, it shows up here.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden divide-y divide-[#F2F2F7]">
          {rows.map(r => {
            const days = r.request_sent_at ? Math.floor((Date.now() - new Date(r.request_sent_at).getTime()) / 86400000) : null
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/account-pursuit/contacts/${r.id}`)}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#1D1D1F]">{fullName(r)}</span>
                    {r.account && <span className="inline-flex items-center gap-1 text-[11px] text-[#AEAEB2]"><Building2 size={10} /> {r.account.name}</span>}
                    {r.has_mutuals && <span className="text-[10px] text-emerald-600 font-medium">warm</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#AEAEB2] mt-0.5">
                    {r.job_title && <span className="truncate max-w-[220px]">{r.job_title}</span>}
                    <span>· sent {days == null ? '—' : days === 0 ? 'today' : `${days}d ago`}</span>
                    {r.linkedin_url && (
                      <a href={r.linkedin_url.trim()} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-teal-600 hover:underline">open <ExternalLink size={9} /></a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {busyId === r.id ? <Loader2 size={15} className="animate-spin text-teal-600 mx-6" /> : <>
                    <button onClick={() => mark(r, 'accepted')} title="Accepted"
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition">
                      <CheckCircle2 size={12} /> Accepted
                    </button>
                    <button onClick={() => mark(r, 'no_response')} title="No response"
                      className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#6E6E73] hover:bg-[#F5F5F7] transition"><MinusCircle size={14} /></button>
                    <button onClick={() => mark(r, 'declined')} title="Declined"
                      className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-rose-600 hover:bg-rose-50 transition"><XCircle size={14} /></button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
