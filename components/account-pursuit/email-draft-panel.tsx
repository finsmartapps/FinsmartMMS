'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, Check, X, Copy, Save, RotateCcw, ShieldCheck, AlertTriangle, Search, ExternalLink, ChevronDown, Send, PauseCircle, PlayCircle } from 'lucide-react'
import { localClock } from '@/lib/agents/clock'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/account-pursuit/helpers'
import type { AbmContact, AbmDraft, AbmResearch, AbmAgentSettings, DraftStatus } from '@/lib/account-pursuit/types'

const STATUS_STYLE: Record<DraftStatus, string> = {
  pending_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-500',
  sent: 'bg-sky-50 text-sky-700',
  failed: 'bg-rose-50 text-rose-700',
}
const STATUS_LABEL: Record<DraftStatus, string> = {
  pending_approval: 'Needs approval', approved: 'Approved, queued to send', rejected: 'Rejected', sent: 'Sent', failed: 'Failed',
}

const field = 'w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] text-[#1D1D1F] focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 transition bg-white'

function scoreCls(n: number | null) {
  if (n == null) return 'bg-slate-100 text-slate-500'
  if (n >= 75) return 'bg-emerald-50 text-emerald-700'
  if (n >= 55) return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}

export default function EmailDraftPanel({ contact, viewerId, isManager = false }: { contact: AbmContact; viewerId: string | null; isManager?: boolean }) {
  const [drafts, setDrafts] = useState<AbmDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState('')
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [research, setResearch] = useState<AbmResearch | null>(null)
  const [stage, setStage] = useState<'researching' | 'writing' | null>(null)
  const [showResearch, setShowResearch] = useState(false)
  const [settings, setSettings] = useState<AbmAgentSettings | null>(null)
  const [sentToday, setSentToday] = useState(0)
  const [notice, setNotice] = useState<Record<string, { ok: boolean; text: string }>>({})

  const loadSending = useCallback(async () => {
    const supabase = createClient()
    const { data: s } = await supabase.from('abm_agent_settings').select('*').eq('id', 1).single()
    if (!s) return
    setSettings(s as AbmAgentSettings)
    const start = localClock((s as AbmAgentSettings).timezone).startOfDayISO
    const { count } = await supabase.from('abm_drafts').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', start)
    setSentToday(count ?? 0)
  }, [])

  const [checking, setChecking] = useState(false)
  const [replyNote, setReplyNote] = useState('')
  async function checkReplies() {
    setChecking(true); setReplyNote('')
    try {
      const r = await fetch('/api/account-pursuit/replies/check', { method: 'POST' })
      const j = await r.json()
      setReplyNote(r.ok ? `${j.note}${j.items?.length ? ': ' + j.items.map((i: { contactName: string; cls: string }) => `${i.contactName} (${i.cls.replace('_', ' ')})`).join(', ') : ''}` : (j.error ?? 'Could not check.'))
      if (r.ok) { await load(); window.dispatchEvent(new Event('abm-replies-checked')) }
    } catch { setReplyNote('Could not reach the server.') }
    setChecking(false)
  }

  async function toggleKill() {
    if (!settings) return
    const supabase = createClient()
    await supabase.from('abm_agent_settings').update({ kill_switch: !settings.kill_switch }).eq('id', 1)
    await loadSending()
  }

  async function sendDraft(d: AbmDraft, mode: 'now' | 'test') {
    setBusy(d.id)
    setNotice(n => { const x = { ...n }; delete x[d.id]; return x })
    try {
      const r = await fetch(`/api/account-pursuit/drafts/${d.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const j = await r.json()
      setNotice(n => ({ ...n, [d.id]: { ok: r.ok, text: r.ok ? (j.message ?? 'Done.') : (j.error ?? 'Failed.') } }))
      if (r.ok && mode === 'now') { await load(); await loadSending() }
    } catch {
      setNotice(n => ({ ...n, [d.id]: { ok: false, text: 'Could not reach the server.' } }))
    }
    setBusy(null)
  }

  const loadResearch = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('abm_research').select('*').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(1)
    setResearch(((data as AbmResearch[]) ?? [])[0] ?? null)
  }, [contact.id])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('abm_drafts').select('*').eq('contact_id', contact.id).eq('channel', 'email').order('created_at', { ascending: false })
    setDrafts((data as AbmDraft[]) ?? [])
    setLoading(false)
  }, [contact.id])

  useEffect(() => { load(); loadResearch(); loadSending() }, [load, loadResearch, loadSending])

  // Re-run (or run) the Researcher on its own.
  async function runResearch(force: boolean) {
    setStage('researching'); setError('')
    try {
      const r = await fetch(`/api/account-pursuit/contacts/${contact.id}/research`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }),
      })
      const d = await r.json()
      if (!r.ok) setError(d.error || 'Research failed.')
      else { setResearch(d.research as AbmResearch); setShowResearch(true) }
      return r.ok
    } catch { setError('Could not reach the server.'); return false }
    finally { setStage(null) }
  }

  async function generate() {
    setGenerating(true); setError('')
    try {
      // 1. research first (cached for 14 days, so repeat drafts are fast)
      setStage('researching')
      await runResearch(false)
      setStage('writing')
      const r = await fetch(`/api/account-pursuit/contacts/${contact.id}/email-draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructions.trim() || undefined }),
      })
      const d = await r.json()
      if (!r.ok) setError(d.error || 'Could not write a draft.')
      else { setInstructions(''); await load() }
    } catch { setError('Could not reach the server.') }
    setStage(null)
    setGenerating(false)
  }

  const current = (d: AbmDraft) => edits[d.id] ?? { subject: d.subject ?? '', body: d.body }
  const dirty = (d: AbmDraft) => !!edits[d.id] && (edits[d.id].subject !== (d.subject ?? '') || edits[d.id].body !== d.body)

  function setEdit(d: AbmDraft, patch: Partial<{ subject: string; body: string }>) {
    setEdits(e => ({ ...e, [d.id]: { ...current(d), ...patch } }))
  }

  async function update(d: AbmDraft, fields: Partial<AbmDraft>) {
    setBusy(d.id)
    const supabase = createClient()
    const c = current(d)
    const payload = { subject: c.subject, body: c.body, ...fields }
    await supabase.from('abm_drafts').update(payload).eq('id', d.id)
    setEdits(e => { const n = { ...e }; delete n[d.id]; return n })
    await load()
    setBusy(null)
  }

  const approve = (d: AbmDraft) => update(d, { status: 'approved', approved_by: viewerId, approved_at: new Date().toISOString() })
  const reject = (d: AbmDraft) => update(d, { status: 'rejected' })
  const reopen = (d: AbmDraft) => update(d, { status: 'pending_approval', approved_by: null, approved_at: null })

  function copy(d: AbmDraft) {
    const c = current(d)
    navigator.clipboard.writeText(`Subject: ${c.subject}\n\n${c.body}`)
    setCopied(d.id); setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 mt-4">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={13} className="text-teal-600" /> Email agents
        </p>
        <button onClick={generate} disabled={generating || !contact.email || contact.do_not_contact}
          className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition">
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {generating ? (stage === 'researching' ? 'Researching the firm…' : 'Writing + fact-checking…') : 'Write email draft'}
        </button>
      </div>
      <p className="text-[11px] text-[#AEAEB2] mb-3">
        A strategist picks one real fact about the firm, a copywriter writes a unique plain-text email, a critic rejects anything that reads like a template. Nothing is sent without your approval.
      </p>

      {settings && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#6E6E73] bg-[#FAFAFA] border border-[#E5E5EA] rounded-lg px-3 py-1.5 mb-3">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${settings.kill_switch ? 'bg-rose-500' : 'bg-emerald-500'}`} />
          <span>{settings.kill_switch ? 'Sending is PAUSED' : 'Sending is on'}</span>
          <span>· {sentToday} sent today (limit starts at 5/day and rises weekly to {settings.daily_cap})</span>
          <span>· {settings.send_start_hour}:00-{settings.send_end_hour}:00 {settings.timezone.split('/')[1]?.replace('_', ' ')}, weekdays</span>
          <button onClick={checkReplies} disabled={checking}
            className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#1D1D1F] hover:text-teal-700 disabled:opacity-60 transition">
            {checking ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Check for replies
          </button>
          {isManager && (
            <button onClick={toggleKill} className="flex items-center gap-1 text-[11px] font-semibold text-[#1D1D1F] hover:text-teal-700 transition">
              {settings.kill_switch ? <><PlayCircle size={13} /> Resume sending</> : <><PauseCircle size={13} /> Pause all sending</>}
            </button>
          )}
        </div>
      )}
      {replyNote && <p className="text-[11px] text-[#6E6E73] bg-[#FAFAFA] border border-[#E5E5EA] rounded-lg px-3 py-1.5 mb-3">Replies: {replyNote}</p>}
      {!contact.email && <p className="text-[12px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-2">Add this contact's email under Contact info to draft an email.</p>}
      <input value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Optional angle, e.g. mention they are hiring in Austin (leave blank for auto)"
        className={`${field} mb-3`} disabled={generating} />
      {error && <p className="text-[12px] text-rose-600 bg-rose-50 px-3 py-2 rounded-lg mb-3">{error}</p>}

      {/* Researcher */}
      <div className="border border-[#E5E5EA] rounded-xl mb-3">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={() => setShowResearch(v => !v)} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D1D1F] flex-1 text-left">
            <Search size={13} className="text-teal-600" />
            Research
            {research && <span className="text-[11px] font-normal text-[#6E6E73]">{research.facts.length} verified fact{research.facts.length === 1 ? '' : 's'} · {fmtDate(research.created_at)}</span>}
            {!research && <span className="text-[11px] font-normal text-[#AEAEB2]">not run yet, runs automatically with the first draft</span>}
            <ChevronDown size={13} className={`ml-auto text-[#AEAEB2] transition ${showResearch ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => runResearch(true)} disabled={stage !== null || generating}
            className="text-[11px] px-2 py-1 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:text-teal-700 hover:border-teal-300 disabled:opacity-50 transition flex items-center gap-1">
            {stage === 'researching' && !generating ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />} {research ? 'Re-run' : 'Run'}
          </button>
        </div>
        {showResearch && research && (
          <div className="px-3 pb-3 space-y-2 border-t border-[#F0F0F2] pt-2">
            {research.note && <p className="text-[11px] text-[#AEAEB2]">{research.note}</p>}
            {research.facts.length === 0 && <p className="text-[12px] text-amber-700">Nothing verifiable found. Drafts will rely on the account details only.</p>}
            {research.facts.map(f => (
              <div key={f.id} className="text-[12px]">
                <div className="flex items-start gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 mt-0.5 flex-shrink-0">{f.subject === 'contact' ? 'person' : f.type}</span>
                  <p className="text-[#1D1D1F]">
                    {f.claim}
                    {f.date && <span className="text-[#AEAEB2]"> · {f.date}</span>}
                    {' '}<a href={f.source_url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline inline-flex items-center gap-0.5">source <ExternalLink size={9} /></a>
                  </p>
                </div>
                <p className="text-[11px] italic text-[#6E6E73] ml-[52px]">&ldquo;{f.evidence}&rdquo;</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-teal-600" /></div>
      ) : drafts.length === 0 ? (
        <p className="text-[12px] text-[#AEAEB2] text-center py-4">No email drafts yet.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map(d => {
            const c = current(d)
            const locked = d.status === 'sent'
            const issues = d.qa_notes?.issues ?? []
            const warns = d.qa_notes?.warnings ?? []
            return (
              <div key={d.id} className="border border-[#E5E5EA] rounded-xl p-3">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${scoreCls(d.qa_score)}`}>
                    <ShieldCheck size={10} /> QA {d.qa_score ?? '–'}
                  </span>
                  <span className="text-[10px] text-[#AEAEB2]">Touch {d.sequence_step} · {fmtDate(d.created_at)}{d.model ? ` · ${d.model}` : ''}</span>
                </div>

                {d.fact_used && (() => {
                  const src = research?.facts.find(f => f.claim === d.fact_used)
                  return (
                    <p className="text-[11px] text-[#6E6E73] mb-2">Built on: <span className="italic">{d.fact_used}</span>
                      {src && <> <a href={src.source_url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline inline-flex items-center gap-0.5">verify source <ExternalLink size={9} /></a></>}
                    </p>
                  )
                })()}

                <input value={c.subject} onChange={e => setEdit(d, { subject: e.target.value })} disabled={locked}
                  className={`${field} font-semibold mb-2`} placeholder="Subject" />
                <textarea value={c.body} onChange={e => setEdit(d, { body: e.target.value })} disabled={locked} rows={10}
                  className={`${field} resize-y leading-relaxed`} />

                {(issues.length > 0 || warns.length > 0) && (
                  <div className="mt-2 space-y-1">
                    {issues.map((m, i) => <p key={`i${i}`} className="text-[11px] text-rose-600 flex gap-1.5"><AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {m}</p>)}
                    {warns.map((m, i) => <p key={`w${i}`} className="text-[11px] text-amber-700 flex gap-1.5"><AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {m}</p>)}
                  </div>
                )}

                {!locked && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {d.status === 'pending_approval' && (
                      <button onClick={() => approve(d)} disabled={busy === d.id}
                        className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition">
                        <Check size={13} /> Approve
                      </button>
                    )}
                    {d.status === 'pending_approval' && (
                      <button onClick={() => reject(d)} disabled={busy === d.id}
                        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:text-rose-600 hover:border-rose-300 transition">
                        <X size={13} /> Reject
                      </button>
                    )}
                    {d.status === 'approved' && (
                      <button onClick={() => sendDraft(d, 'now')} disabled={busy === d.id}
                        className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition">
                        {busy === d.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send now
                      </button>
                    )}
                    {(d.status === 'approved' || d.status === 'pending_approval') && (
                      <button onClick={() => sendDraft(d, 'test')} disabled={busy === d.id}
                        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:text-teal-700 hover:border-teal-300 disabled:opacity-60 transition">
                        <Send size={13} /> Send test to me
                      </button>
                    )}
                    {(d.status === 'approved' || d.status === 'rejected' || d.status === 'failed') && (
                      <button onClick={() => reopen(d)} disabled={busy === d.id}
                        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
                        <RotateCcw size={13} /> Back to review
                      </button>
                    )}
                    {dirty(d) && (
                      <button onClick={() => update(d, {})} disabled={busy === d.id}
                        className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 transition">
                        <Save size={13} /> Save edits
                      </button>
                    )}
                    <button onClick={() => copy(d)} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] transition ml-auto">
                      {copied === d.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />} Copy
                    </button>
                  </div>
                )}
                {notice[d.id] && <p className={`text-[11px] mt-2 ${notice[d.id].ok ? 'text-emerald-700' : 'text-rose-600'}`}>{notice[d.id].text}</p>}
                {d.send_error && <p className="text-[11px] text-rose-600 mt-2">Send error: {d.send_error}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
