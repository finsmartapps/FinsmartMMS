'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, Check, X, Copy, Save, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/account-pursuit/helpers'
import type { AbmContact, AbmDraft, DraftStatus } from '@/lib/account-pursuit/types'

const STATUS_STYLE: Record<DraftStatus, string> = {
  pending_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-500',
  sent: 'bg-sky-50 text-sky-700',
  failed: 'bg-rose-50 text-rose-700',
}
const STATUS_LABEL: Record<DraftStatus, string> = {
  pending_approval: 'Needs approval', approved: 'Approved', rejected: 'Rejected', sent: 'Sent', failed: 'Failed',
}

const field = 'w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] text-[#1D1D1F] focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 transition bg-white'

function scoreCls(n: number | null) {
  if (n == null) return 'bg-slate-100 text-slate-500'
  if (n >= 75) return 'bg-emerald-50 text-emerald-700'
  if (n >= 55) return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}

export default function EmailDraftPanel({ contact, viewerId }: { contact: AbmContact; viewerId: string | null }) {
  const [drafts, setDrafts] = useState<AbmDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState('')
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('abm_drafts').select('*').eq('contact_id', contact.id).eq('channel', 'email').order('created_at', { ascending: false })
    setDrafts((data as AbmDraft[]) ?? [])
    setLoading(false)
  }, [contact.id])

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true); setError('')
    try {
      const r = await fetch(`/api/account-pursuit/contacts/${contact.id}/email-draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructions.trim() || undefined }),
      })
      const d = await r.json()
      if (!r.ok) setError(d.error || 'Could not write a draft.')
      else { setInstructions(''); await load() }
    } catch { setError('Could not reach the server.') }
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
          {generating ? 'Strategist + Copywriter + Critic working…' : 'Write email draft'}
        </button>
      </div>
      <p className="text-[11px] text-[#AEAEB2] mb-3">
        A strategist picks one real fact about the firm, a copywriter writes a unique plain-text email, a critic rejects anything that reads like a template. Nothing is sent without your approval.
      </p>

      {!contact.email && <p className="text-[12px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-2">Add this contact's email under Contact info to draft an email.</p>}
      <input value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Optional angle, e.g. mention they are hiring in Austin (leave blank for auto)"
        className={`${field} mb-3`} disabled={generating} />
      {error && <p className="text-[12px] text-rose-600 bg-rose-50 px-3 py-2 rounded-lg mb-3">{error}</p>}

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

                {d.fact_used && <p className="text-[11px] text-[#6E6E73] mb-2">Built on: <span className="italic">{d.fact_used}</span></p>}

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
                {d.send_error && <p className="text-[11px] text-rose-600 mt-2">Send error: {d.send_error}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
