'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/marketing/ui/button'
import { Upload, X, Loader2, Check, FileText, ClipboardPaste, AlertCircle, TriangleAlert, Info } from 'lucide-react'
import { parseSheetDate, classifyLeadSource, defaultStatusFromSource, normalizeStatus, CATEGORY_STYLES, HOURS_PER_SEAT } from '@/lib/leads'

const CLOSED_WON = 'Closed Won'

interface Suggestion { level: 'warn' | 'info'; name: string; text: string }

function getSuggestions(rows: ParsedLead[]): Suggestion[] {
  const out: Suggestion[] = []
  const today = new Date().toISOString().split('T')[0]

  for (const r of rows) {
    const name = (r.name as string) || '(no name)'
    const isWon   = r.lead_stage === CLOSED_WON
    const hasSeats = Number(r.closed_hours) > 0
    const hasMRR   = Number(r.mrr_value) > 0
    const hasOT    = Number(r.one_time_revenue) > 0

    // No email → can't dedup on future imports, may create duplicates
    if (!(r.email as string)?.trim())
      out.push({ level: 'warn', name, text: `has no email — can't be deduplicated on future imports, may create duplicate entries` })

    if ((hasSeats || hasMRR || hasOT) && !isWon)
      out.push({ level: 'warn', name, text: `Lead Stage is not "Closed Won" but has seat/MRR data — won't count toward closed metrics` })

    if (isWon && !r.closed_date)
      out.push({ level: 'warn', name, text: `is "Closed Won" but has no Closed Date — won't appear in any date filter` })

    if (isWon && !hasSeats && !hasMRR && !hasOT)
      out.push({ level: 'warn', name, text: `is "Closed Won" but has no Seats, MRR, or One-time value — won't contribute to any metric` })

    if (r.closed_date && !isWon)
      out.push({ level: 'warn', name, text: `has a Closed Date but Lead Stage is not "Closed Won" — date will be ignored` })

    if (r.closed_date && (r.closed_date as string) > today)
      out.push({ level: 'info', name, text: `has a Closed Date in the future (${r.closed_date}) — double-check if correct` })

    if (r.lead_date && (r.lead_date as string) > today)
      out.push({ level: 'info', name, text: `has a Lead Date in the future (${r.lead_date}) — double-check if correct` })

    if (r.closed_date && r.lead_date && (r.closed_date as string) < (r.lead_date as string))
      out.push({ level: 'warn', name, text: `Closed Date (${r.closed_date}) is earlier than Lead Date (${r.lead_date}) — likely a data entry error` })
  }

  return out
}

type ParsedLead = Record<string, string | number | boolean | null>

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return isNaN(n) || s.trim() === '' ? null : n
}

interface SkippedRow { sr: string; rowNum: number; preview: string }

// Parse the entire CSV/TSV text in one pass, respecting quoted multi-line cells.
// This prevents embedded newlines inside quotes from being treated as row breaks.
function parseAllRows(text: string): string[][] {
  // Detect delimiter from the first line
  const firstLine = text.slice(0, text.indexOf('\n') + 1 || text.length)
  const delim = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ','

  const allRows: string[][] = []
  let cells: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ }      // escaped quote
      else if (ch === '"') { inQuotes = false }                         // close quote
      else { cur += ch }                                                // content (including \n)
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      cells.push(cur.trim()); cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++                     // \r\n → single break
      cells.push(cur.trim()); cur = ''
      if (cells.some(c => c)) allRows.push(cells)                      // skip fully-blank rows
      cells = []
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  if (cells.some(c => c)) allRows.push(cells)
  return allRows
}

function buildLeads(text: string, hasHeader: boolean): { rows: ParsedLead[]; skipped: SkippedRow[]; inBatchDup: number } {
  const today = new Date().toISOString().split('T')[0]
  const allRows = parseAllRows(text)
  const dataRows = hasHeader ? allRows.slice(1) : allRows

  const rows: ParsedLead[] = []
  // Key: email (non-CW) or email|closed_date (CW) → row index
  const idxByKey = new Map<string, number>()
  const skipped: SkippedRow[] = []
  let inBatchDup = 0
  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i]
    const c = (idx: number) => (cells[idx] ?? '').trim()
    const name = c(2)
    if (!name) {
      const sr = c(0) || `row ${i + (hasHeader ? 2 : 1)}`
      const nonEmpty = cells.filter(v => v.trim()).slice(0, 3).join(' · ')
      skipped.push({ sr, rowNum: i + (hasHeader ? 2 : 1), preview: nonEmpty || '(all empty)' })
      continue
    }
    const email = c(3)
    const emailKey = email.toLowerCase()
    const lead_source = c(11)
    const closedDate = parseSheetDate(c(19))
    const leadStage = c(17) || 'New'
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
      lead_stage: leadStage,
      customer_type: c(18),
      closed_date: closedDate,
      closed_hours: c(20) ? (parseNum(c(20)) ?? 0) * HOURS_PER_SEAT : null,
      mrr_value: parseNum(c(21)),
      one_time_revenue: parseNum(c(22)),
      // col 23 = Seat Type (informational, not stored)
      successful_meetings: c(24).toLowerCase() === 'yes',
      category: classifyLeadSource(lead_source),
      updated_at: new Date().toISOString(),
    }
    // For Closed Won rows with a closed date, use email|date as the dedup key so
    // the same client with multiple packages (different dates) are kept as separate rows.
    const rowKey = emailKey
      ? (leadStage === CLOSED_WON && closedDate ? `${emailKey}|${closedDate}` : emailKey)
      : null
    if (rowKey && idxByKey.has(rowKey)) {
      rows[idxByKey.get(rowKey)!] = row
      inBatchDup++
    } else {
      if (rowKey) idxByKey.set(rowKey, rows.length)
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
  const preview = text.trim() ? buildLeads(text, hasHeader) : { rows: [], skipped: [] as SkippedRow[], inBatchDup: 0 }

  // split preview rows into new vs already-existing (by email or email+date for CW) for the summary
  const emailKey = (r: ParsedLead) => ((r.email as string) || '').trim().toLowerCase()
  const newRows = preview.rows.filter(r => {
    const k = emailKey(r)
    return !k || !emailSet.has(k)
  })
  const existingRows = preview.rows.filter(r => {
    const k = emailKey(r)
    return k !== '' && emailSet.has(k)
  })
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
    const { data: dbLeads, error: fetchErr } = await supabase.from('leads').select('id, email, closed_date, lead_stage')
    if (fetchErr) { setImporting(false); setError(fetchErr.message); return }
    const idByEmail = new Map<string, string>()        // email → id
    const idByEmailDate = new Map<string, string>()    // email|closed_date → id (Closed Won)
    for (const l of dbLeads ?? []) {
      const k = (l.email || '').trim().toLowerCase()
      if (!k) continue
      idByEmail.set(k, l.id as string)
      if (l.lead_stage === CLOSED_WON && l.closed_date)
        idByEmailDate.set(`${k}|${l.closed_date}`, l.id as string)
    }

    // For Closed Won rows with a closed_date, match by email+date so that one
    // client with multiple packages (different dates) maps to the right DB row.
    const matchKey = (r: ParsedLead) => {
      const k = emailKey(r)
      if (!k) return null
      if ((r.lead_stage as string) === CLOSED_WON && r.closed_date)
        return idByEmailDate.has(`${k}|${r.closed_date}`) ? `${k}|${r.closed_date}` : k
      return k
    }
    const idMap = new Map([...idByEmail, ...idByEmailDate])

    const toInsert = preview.rows.filter(r => { const k = matchKey(r); return !k || !idMap.has(k) })
    const toUpdate = preview.rows.filter(r => { const k = matchKey(r); return k !== null && idMap.has(k) })

    let inserted = 0, updated = 0

    if (toInsert.length) {
      const { error } = await supabase.from('leads').insert(toInsert)
      if (error) { setImporting(false); setError(error.message); return }
      inserted = toInsert.length
    }

    // Only overwrite existing leads when the user chose "replace"
    if (dupMode === 'replace' && toUpdate.length) {
      for (const r of toUpdate) {
        const k = matchKey(r)!
        const id = idMap.get(k)!
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
                    {preview.skipped.length > 0 && <span className="text-xs text-rose-600 font-semibold">· {preview.skipped.length} skipped (no name)</span>}
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

              {preview.skipped.length > 0 && (
                <div className="rounded-xl ring-1 ring-rose-200 bg-rose-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-rose-100 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                      {preview.skipped.length} row{preview.skipped.length === 1 ? '' : 's'} skipped — Name column (column C) is empty
                    </span>
                  </div>
                  <div className="divide-y divide-rose-100">
                    {preview.skipped.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs text-rose-800">
                        <span className="font-bold text-rose-500 shrink-0">Sr {s.sr}</span>
                        <span className="text-rose-400">row {s.rowNum} in file</span>
                        {s.preview !== '(all empty)' && (
                          <span className="text-rose-600 truncate">{s.preview}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="rounded-xl ring-1 ring-amber-200 bg-amber-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-amber-100 flex items-center gap-1.5">
                    <TriangleAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                      {suggestions.length} data issue{suggestions.length === 1 ? '' : 's'} found — review before importing
                    </span>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {suggestions.map((s, i) => (
                      <div key={i} className={`flex items-start gap-2.5 px-3 py-2 text-xs ${
                        s.level === 'warn' ? 'text-amber-800' : 'text-blue-800'
                      }`}>
                        {s.level === 'warn'
                          ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                          : <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />}
                        <span><span className="font-bold">{s.name}</span> — {s.text}</span>
                      </div>
                    ))}
                  </div>
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
