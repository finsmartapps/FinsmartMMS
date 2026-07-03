'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/marketing/ui/button'
import { Upload, X, Loader2, Check, FileText, ClipboardPaste, AlertCircle, TriangleAlert, Info } from 'lucide-react'
import { parseDelimitedLine, parseSheetDate, classifyLeadSource, defaultStatusFromSource, normalizeStatus, CATEGORY_STYLES, HOURS_PER_SEAT } from '@/lib/leads'

const CLOSED_WON = 'Closed Won'

function nameList(rows: ParsedLead[]) {
  const names = rows.map(r => r.name as string).filter(Boolean)
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`
}

interface Suggestion { level: 'warn' | 'info'; text: string; names: string }

function getSuggestions(rows: ParsedLead[]): Suggestion[] {
  const out: Suggestion[] = []

  // Seat/MRR data but stage is not Closed Won → won't count
  const seatsButNotWon = rows.filter(r =>
    (Number(r.closed_hours) > 0 || Number(r.mrr_value) > 0 || Number(r.one_time_revenue) > 0) &&
    r.lead_stage !== CLOSED_WON
  )
  if (seatsButNotWon.length)
    out.push({ level: 'warn', text: `has seat/MRR data but Lead Stage is not "Closed Won" — won't count toward closed metrics`, names: nameList(seatsButNotWon) })

  // Closed Won but no closed date → invisible in date filters
  const wonNoDate = rows.filter(r => r.lead_stage === CLOSED_WON && !r.closed_date)
  if (wonNoDate.length)
    out.push({ level: 'warn', text: `is "Closed Won" but has no Closed Date — won't appear in any date filter`, names: nameList(wonNoDate) })

  // Closed Won but no revenue at all → deal adds nothing to metrics
  const wonNoRevenue = rows.filter(r =>
    r.lead_stage === CLOSED_WON &&
    !Number(r.closed_hours) && !Number(r.mrr_value) && !Number(r.one_time_revenue)
  )
  if (wonNoRevenue.length)
    out.push({ level: 'warn', text: `is "Closed Won" but has no Seats, MRR, or One-time value — deal won't contribute to any metrics`, names: nameList(wonNoRevenue) })

  // Has a closed date but stage is not Closed Won → date will be ignored
  const dateButNotWon = rows.filter(r =>
    r.closed_date && r.lead_stage !== CLOSED_WON
  )
  if (dateButNotWon.length)
    out.push({ level: 'warn', text: `has a Closed Date but Lead Stage is not "Closed Won" — date will be ignored`, names: nameList(dateButNotWon) })

  // Closed date is in the future (possible data entry error)
  const today = new Date().toISOString().split('T')[0]
  const futureClosed = rows.filter(r => r.closed_date && (r.closed_date as string) > today)
  if (futureClosed.length)
    out.push({ level: 'info', text: `has a Closed Date in the future — double-check if this is correct`, names: nameList(futureClosed) })

  // Lead date is in the future
  const futureLeadDate = rows.filter(r => r.lead_date && (r.lead_date as string) > today)
  if (futureLeadDate.length)
    out.push({ level: 'info', text: `has a Lead Date in the future — double-check if this is correct`, names: nameList(futureLeadDate) })

  // Closed date is before lead date (logically impossible)
  const closedBeforeLead = rows.filter(r =>
    r.closed_date && r.lead_date && (r.closed_date as string) < (r.lead_date as string)
  )
  if (closedBeforeLead.length)
    out.push({ level: 'warn', text: `has a Closed Date earlier than its Lead Date — likely a data entry error`, names: nameList(closedBeforeLead) })

  return out
}

type ParsedLead = Record<string, string | number | null>

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return isNaN(n) || s.trim() === '' ? null : n
}

function buildLeads(text: string, hasHeader: boolean): { rows: ParsedLead[]; skipped: number; inBatchDup: number } {
  const today = new Date().toISOString().split('T')[0]
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '')
  // Detect delimiter from the FIRST line only — a stray tab inside a later
  // quoted cell must not flip a comma-separated file to tab-separated.
  const head = lines[0] || ''
  const tabCount = (head.match(/\t/g) || []).length
  const commaCount = (head.match(/,/g) || []).length
  const delim = tabCount > commaCount ? '\t' : ','
  let dataLines = lines
  if (hasHeader && lines.length) dataLines = lines.slice(1)

  const rows: ParsedLead[] = []
  const idxByEmail = new Map<string, number>() // emailKey → index in rows (for within-batch dedup)
  let skipped = 0
  let inBatchDup = 0
  for (const line of dataLines) {
    const cells = parseDelimitedLine(line, delim)
    const c = (i: number) => (cells[i] ?? '').trim()
    const name = c(2)
    if (!name) { skipped++; continue }
    const email = c(3)
    const emailKey = email.toLowerCase()
    const lead_source = c(11)
    const row: ParsedLead = {
      lead_date: parseSheetDate(c(1)) || today,
      name,
      email,
      phone: c(4),
      website_url: c(5),
      company_name: c(6),
      industry: c(7),
      service_required: c(8),
      data_source: c(9),
      lead_from: c(10),
      lead_source,
      state: c(12),
      country: c(13),
      comment: c(14),
      assigned_to: c(15),
      lead_status: normalizeStatus(c(16)) || defaultStatusFromSource(lead_source),
      lead_stage: c(17) || 'New',
      customer_type: c(18),
      closed_date: parseSheetDate(c(19)),
      closed_hours: c(20) ? (parseNum(c(20)) ?? 0) * HOURS_PER_SEAT : null,
      mrr_value: parseNum(c(21)),
      one_time_revenue: parseNum(c(22)),
      category: classifyLeadSource(lead_source),
      updated_at: new Date().toISOString(),
    }
    // dedupe rows that repeat the same email WITHIN the file (last row wins)
    if (emailKey && idxByEmail.has(emailKey)) {
      rows[idxByEmail.get(emailKey)!] = row
      inBatchDup++
    } else {
      if (emailKey) idxByEmail.set(emailKey, rows.length)
      rows.push(row)
    }
  }
  return { rows, skipped, inBatchDup }
}

export default function ImportLeads({ existingEmails = [] }: { existingEmails?: string[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [dupMode, setDupMode] = useState<'skip' | 'replace'>('skip')
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ inserted: number; updated: number } | null>(null)
  const [error, setError] = useState('')

  const emailSet = new Set(existingEmails.map(e => e.trim().toLowerCase()).filter(Boolean))
  const preview = text.trim() ? buildLeads(text, hasHeader) : { rows: [], skipped: 0, inBatchDup: 0 }

  // split preview rows into new vs already-existing (by email) for the summary
  const emailKey = (r: ParsedLead) => ((r.email as string) || '').trim().toLowerCase()
  const newRows = preview.rows.filter(r => { const k = emailKey(r); return !k || !emailSet.has(k) })
  const existingRows = preview.rows.filter(r => { const k = emailKey(r); return k && emailSet.has(k) })
  const newCount = newRows.length
  const existingCount = existingRows.length

  const suggestions = text.trim() ? getSuggestions(preview.rows) : []

  const catCounts = preview.rows.reduce<Record<string, number>>((a, r) => {
    const k = (r.category as string) || 'Unclassified'; a[k] = (a[k] ?? 0) + 1; return a
  }, {})

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setText(await file.text())
  }

  async function handleImport() {
    if (!preview.rows.length) return
    setImporting(true); setError('')

    // Fetch the current id↔email map fresh so we update the right rows and
    // never collide with the unique-email index.
    const { data: dbLeads, error: fetchErr } = await supabase.from('leads').select('id, email')
    if (fetchErr) { setImporting(false); setError(fetchErr.message); return }
    const idByEmail = new Map<string, string>()
    for (const l of dbLeads ?? []) {
      const k = (l.email || '').trim().toLowerCase()
      if (k) idByEmail.set(k, l.id as string)
    }

    const toInsert = preview.rows.filter(r => { const k = emailKey(r); return !k || !idByEmail.has(k) })
    const toUpdate = preview.rows.filter(r => { const k = emailKey(r); return k && idByEmail.has(k) })

    let inserted = 0, updated = 0

    if (toInsert.length) {
      const { error } = await supabase.from('leads').insert(toInsert)
      if (error) { setImporting(false); setError(error.message); return }
      inserted = toInsert.length
    }

    // Only overwrite existing leads when the user chose "replace"
    if (dupMode === 'replace' && toUpdate.length) {
      for (const r of toUpdate) {
        const id = idByEmail.get(emailKey(r))!
        const { error } = await supabase.from('leads').update(r).eq('id', id)
        if (error) { setImporting(false); setError(error.message); return }
        updated++
      }
    }

    setImporting(false)
    setDone({ inserted, updated })
    setText('')
    setTimeout(() => { setDone(null); setOpen(false); router.refresh() }, 1600)
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="gap-1.5 font-bold rounded-xl bg-white/15 hover:bg-white/25 text-white border-white/30 backdrop-blur"
      >
        <Upload className="h-4 w-4" /> Import
      </Button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-sm p-4 sm:p-8">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 my-4 animate-rise">
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Upload className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Import Leads</h3>
                  <p className="text-xs text-slate-400">Paste rows from Excel, or upload a CSV — in your sheet&apos;s column order</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* column order hint */}
              <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 ring-1 ring-slate-100 leading-relaxed">
                <span className="font-bold text-slate-600">Expected column order:</span> Sr · Date · Name · Email · Phone · Website · Company · Industry · Service · Data Source · Lead From · Lead Source · State · Country · Comment · Assigned · Lead Status · Lead Stage · Customer Type · <span className="text-emerald-700 font-bold">Closed Date · Seats Closed · MRR Value · One-time Revenue</span>
              </div>

              {/* paste */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <ClipboardPaste className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Paste rows</span>
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={7}
                  placeholder="Select the data rows in Excel, copy, and paste here…"
                  className="w-full text-xs font-mono border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
                />
              </div>

              {/* options + upload */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                  First row is a header (skip it)
                </label>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  Upload CSV instead
                  <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
                </label>
              </div>

              {/* duplicate-email handling */}
              <div className="rounded-xl ring-1 ring-slate-100 bg-slate-50/60 p-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">If a lead&apos;s email already exists</p>
                <div className="flex bg-white ring-1 ring-slate-200 rounded-lg p-0.5 gap-0.5 w-fit">
                  {([
                    { v: 'skip',    label: 'Skip it',    hint: 'keep the existing lead' },
                    { v: 'replace', label: 'Replace it', hint: 'overwrite with this row' },
                  ] as const).map(o => (
                    <button
                      key={o.v}
                      onClick={() => setDupMode(o.v)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${dupMode === o.v ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      title={o.hint}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {dupMode === 'skip'
                    ? 'New leads are added; rows whose email already exists are left untouched.'
                    : 'New leads are added; rows whose email already exists overwrite the existing lead.'}
                </p>
              </div>

              {/* preview */}
              {text.trim() && (
                <div className="rounded-xl ring-1 ring-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-emerald-700">{newCount} new</span>
                    {existingCount > 0 && (
                      <span className={`text-sm font-bold ${dupMode === 'replace' ? 'text-indigo-700' : 'text-amber-600'}`}>
                        · {existingCount} {dupMode === 'replace' ? 'to update' : 'to skip (already exist)'}
                      </span>
                    )}
                    {preview.skipped > 0 && <span className="text-xs text-amber-600">· {preview.skipped} skipped (no name)</span>}
                    {preview.inBatchDup > 0 && <span className="text-xs text-slate-400">· {preview.inBatchDup} merged (repeated in file)</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {Object.entries(catCounts).map(([cat, n]) => (
                      <span key={cat} className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-0.5 ring-1 ${CATEGORY_STYLES[cat as keyof typeof CATEGORY_STYLES]?.badge ?? 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLES[cat as keyof typeof CATEGORY_STYLES]?.dot ?? 'bg-slate-400'}`} />
                        {n} {cat}
                      </span>
                    ))}
                  </div>
                  {preview.rows.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-2.5">
                      First: <span className="font-medium text-slate-600">{preview.rows[0].name as string}</span>
                      {preview.rows[0].lead_source ? ` · ${preview.rows[0].lead_source}` : ''}
                      {preview.rows[0].lead_date ? ` · ${preview.rows[0].lead_date}` : ''}
                    </p>
                  )}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs ring-1 ${
                      s.level === 'warn'
                        ? 'bg-amber-50 text-amber-800 ring-amber-200'
                        : 'bg-blue-50 text-blue-800 ring-blue-200'
                    }`}>
                      {s.level === 'warn'
                        ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                        : <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />}
                      <div>
                        <span className="font-bold">{s.names}</span>
                        <span className="ml-1">{s.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-500">Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={importing || !preview.rows.length}
                className={`gap-1.5 font-bold rounded-xl border-0 text-white min-w-[170px] ${done ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500'}`}
              >
                {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                  : done ? <><Check className="h-4 w-4" /> {done.inserted} added{done.updated ? `, ${done.updated} updated` : ''}</>
                  : <><Upload className="h-4 w-4" /> {dupMode === 'replace' && existingCount > 0 ? `Import ${newCount}, update ${existingCount}` : `Import ${newCount || ''}`}</>}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
