'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getViewer } from '@/lib/account-pursuit/helpers'
import { buildHeaderMap, parseRows, type ParsedAccount } from '@/lib/account-pursuit/import'

type Result = { accountsCreated: number; accountsMatched: number; contactsCreated: number; contactsSkipped: number }

export default function ImportPage() {
  const router = useRouter()
  const [fileName, setFileName] = useState('')
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null)
  const [sheet, setSheet] = useState('')
  const [parsed, setParsed] = useState<ParsedAccount[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setParsed(null); setResult(null); setParseError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const book = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), { type: 'array' })
        setWb(book)
        const preferred = book.SheetNames.find(n => /mix/i.test(n)) ?? book.SheetNames[0]
        setSheet(preferred)
        parseSheet(book, preferred)
      } catch {
        setParseError('Could not read this file. Make sure it is a valid .xlsx.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function parseSheet(book: XLSX.WorkBook, name: string) {
    setParseError(''); setResult(null)
    const ws = book.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: false })
    if (rows.length < 2) { setParsed(null); setParseError('That sheet looks empty.'); return }
    const map = buildHeaderMap(rows[0])
    if (!('company_name' in map)) {
      setParsed(null)
      setParseError('Could not find a "Company Name" column on this sheet. Pick the sheet that has the data table.')
      return
    }
    setParsed(parseRows(rows.slice(1), map))
  }

  const stats = useMemo(() => {
    if (!parsed) return null
    const contacts = parsed.reduce((s, a) => s + a.contacts.length, 0)
    const tiers = { A: 0, B: 0, C: 0 }
    parsed.forEach(a => { tiers[a.tier]++ })
    const withLinkedin = parsed.reduce((s, a) => s + a.contacts.filter(c => c.linkedin_url).length, 0)
    return { accounts: parsed.length, contacts, tiers, withLinkedin }
  }, [parsed])

  async function runImport() {
    if (!parsed) return
    setImporting(true); setResult(null)
    const viewer = await getViewer()
    if (!viewer) { setImporting(false); setParseError('Not signed in.'); return }
    const supabase = createClient()

    // Existing accounts (dedup by lower name) + existing contact linkedin URLs (dedup)
    const [{ data: existAccts }, { data: existContacts }] = await Promise.all([
      supabase.from('abm_accounts').select('id, name'),
      supabase.from('abm_contacts').select('linkedin_url'),
    ])
    const nameToId = new Map<string, string>()
    for (const a of (existAccts ?? []) as { id: string; name: string }[]) nameToId.set(a.name.toLowerCase(), a.id)
    const seenLinkedin = new Set<string>()
    for (const c of (existContacts ?? []) as { linkedin_url: string | null }[]) {
      if (c.linkedin_url) seenLinkedin.add(c.linkedin_url.toLowerCase())
    }

    // Insert new accounts
    const newAccounts = parsed.filter(a => !nameToId.has(a.name.toLowerCase()))
    let accountsCreated = 0
    if (newAccounts.length) {
      const payload = newAccounts.map(a => ({
        name: a.name, website: a.website, industry: a.industry, targeted_industry: a.targeted_industry,
        revenue_text: a.revenue_text, revenue_usd: a.revenue_usd, employee_size: a.employee_size, tier: a.tier,
        state: a.state, country: a.country, address: a.address, associations: a.associations,
        software_partnerships: a.software_partnerships, offshore_presence: a.offshore_presence,
        other_industries: a.other_industries, owner_id: viewer.id, created_by: viewer.id, source: 'aggregator_import',
      }))
      const { data: inserted, error } = await supabase.from('abm_accounts').insert(payload).select('id, name')
      if (error) { setImporting(false); setParseError('Account import failed: ' + error.message); return }
      for (const a of (inserted ?? []) as { id: string; name: string }[]) nameToId.set(a.name.toLowerCase(), a.id)
      accountsCreated = inserted?.length ?? 0
    }

    // Build contacts, dedup by linkedin_url
    let contactsSkipped = 0
    const contactRows: Record<string, unknown>[] = []
    for (const a of parsed) {
      const accountId = nameToId.get(a.name.toLowerCase())
      if (!accountId) continue
      for (const c of a.contacts) {
        const li = c.linkedin_url?.toLowerCase()
        if (li && seenLinkedin.has(li)) { contactsSkipped++; continue }
        if (li) seenLinkedin.add(li)
        contactRows.push({
          account_id: accountId, first_name: c.first_name, last_name: c.last_name, job_title: c.job_title,
          committee_role: c.committee_role, linkedin_url: c.linkedin_url, email: c.email,
          office_number: c.office_number, direct_number: c.direct_number, mutual_connections: c.mutual_connections,
          has_mutuals: c.has_mutuals, owner_id: viewer.id, created_by: viewer.id,
        })
      }
    }

    // Insert contacts in chunks
    let contactsCreated = 0
    for (let i = 0; i < contactRows.length; i += 200) {
      const chunk = contactRows.slice(i, i + 200)
      const { error } = await supabase.from('abm_contacts').insert(chunk)
      if (error) { setImporting(false); setParseError('Contact import failed: ' + error.message); return }
      contactsCreated += chunk.length
    }

    setImporting(false)
    setResult({ accountsCreated, accountsMatched: parsed.length - accountsCreated, contactsCreated, contactsSkipped })
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-[19px] font-bold text-[#1D1D1F] leading-tight">Import Aggregator Data</h1>
          <p className="text-[12px] text-[#6E6E73]">Upload your aggregator .xlsx — it groups rows into accounts + committee contacts.</p>
        </div>
      </div>

      {/* Upload */}
      <label className="block border-2 border-dashed border-[#E5E5EA] rounded-2xl px-6 py-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition">
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
        <Upload size={22} className="text-teal-500 mx-auto mb-2" />
        <p className="text-[13px] font-semibold text-[#1D1D1F]">{fileName || 'Choose an .xlsx file'}</p>
        <p className="text-[11px] text-[#AEAEB2] mt-1">Parsed in your browser — nothing uploads until you confirm.</p>
      </label>

      {/* Sheet picker */}
      {wb && wb.SheetNames.length > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[12px] text-[#6E6E73]">Sheet:</span>
          <select value={sheet} onChange={e => { setSheet(e.target.value); parseSheet(wb, e.target.value) }}
            className="h-8 border border-[#E5E5EA] rounded-lg px-2 text-[12px] bg-white text-[#1D1D1F]">
            {wb.SheetNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {parseError && (
        <div className="mt-4 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-[12px] rounded-xl px-3 py-2.5">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {parseError}
        </div>
      )}

      {/* Preview */}
      {stats && !result && (
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="Accounts" value={stats.accounts} />
            <Stat label="Contacts" value={stats.contacts} />
            <Stat label="With LinkedIn" value={stats.withLinkedin} />
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 mb-4">
            <p className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-2">Auto-tiering</p>
            <div className="flex gap-4 text-[13px] text-[#1D1D1F]">
              <span><b>{stats.tiers.A}</b> Tier A</span>
              <span><b>{stats.tiers.B}</b> Tier B</span>
              <span><b>{stats.tiers.C}</b> Tier C</span>
            </div>
            <p className="text-[11px] text-[#AEAEB2] mt-2 leading-relaxed">
              By size (revenue &amp; headcount): <b>A</b> = $25M+ or 250+ staff · <b>B</b> = $10M+ or 50+ · <b>C</b> = smaller/unknown. Higher tier = higher priority.
            </p>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden mb-4">
            <p className="px-4 py-2.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider border-b border-[#F2F2F7]">Sample (first 6)</p>
            <div className="divide-y divide-[#F2F2F7]">
              {parsed!.slice(0, 6).map((a, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-semibold text-[#1D1D1F]">{a.name}</span>
                    <span className="text-[11px] text-[#AEAEB2] ml-2">Tier {a.tier}{a.revenue_text ? ` · ${a.revenue_text}` : ''}</span>
                  </div>
                  <span className="text-[11px] text-[#6E6E73]">{a.contacts.length} contact{a.contacts.length === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={runImport} disabled={importing}
            className="w-full flex items-center justify-center gap-2 text-[14px] font-semibold px-5 py-3 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition">
            {importing ? <><Loader2 size={16} className="animate-spin" /> Importing…</> : <>Import {stats.accounts} accounts · {stats.contacts} contacts</>}
          </button>
          <p className="text-[11px] text-[#AEAEB2] text-center mt-2">Existing accounts (by name) and contacts (by LinkedIn URL) are skipped, so re-importing is safe.</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6 bg-white border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <p className="text-[15px] font-semibold text-[#1D1D1F]">Import complete</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px] text-[#1D1D1F]">
            <div><b>{result.accountsCreated}</b> accounts created</div>
            <div><b>{result.accountsMatched}</b> already existed</div>
            <div><b>{result.contactsCreated}</b> contacts created</div>
            <div><b>{result.contactsSkipped}</b> duplicates skipped</div>
          </div>
          <button onClick={() => router.push('/account-pursuit/accounts')}
            className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition">
            View accounts <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl px-4 py-3 text-center">
      <div className="text-[22px] font-bold text-teal-600">{value}</div>
      <div className="text-[11px] text-[#AEAEB2] uppercase tracking-wider">{label}</div>
    </div>
  )
}
