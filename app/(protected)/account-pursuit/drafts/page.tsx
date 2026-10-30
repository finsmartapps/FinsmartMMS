'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MailCheck, Loader2, Check, X, ExternalLink, ShieldCheck, ChevronDown, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getViewer, fmtDate } from '@/lib/account-pursuit/helpers'
import type { AbmDraft } from '@/lib/account-pursuit/types'

type Row = AbmDraft & {
  contact: { id: string; first_name: string; last_name: string | null; email: string | null; job_title: string | null } | null
  account: { name: string } | null
}

function scoreCls(n: number | null) {
  if (n == null) return 'bg-slate-100 text-slate-500'
  if (n >= 75) return 'bg-emerald-50 text-emerald-700'
  if (n >= 55) return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}

export default function ApprovalsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('abm_drafts')
      .select('*, contact:abm_contacts(id, first_name, last_name, email, job_title), account:abm_accounts(name)')
      .eq('channel', 'email').in('status', ['pending_approval', 'approved'])
      .order('created_at', { ascending: false })
    setRows((data as unknown as Row[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { getViewer().then(v => setViewerId(v?.id ?? null)); load() }, [load])

  async function setStatus(r: Row, status: 'approved' | 'rejected') {
    setBusy(r.id)
    const supabase = createClient()
    const fields = status === 'approved'
      ? { status, approved_by: viewerId, approved_at: new Date().toISOString() }
      : { status }
    await supabase.from('abm_drafts').update(fields).eq('id', r.id)
    await load()
    setBusy(null)
  }

  const pending = rows.filter(r => r.status === 'pending_approval')
  const queued = rows.filter(r => r.status === 'approved')

  const card = (r: Row, withActions: boolean) => {
    const name = r.contact ? `${r.contact.first_name} ${r.contact.last_name ?? ''}`.trim() : 'Unknown contact'
    const isOpen = open === r.id
    return (
      <div key={r.id} className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-bold text-[#1D1D1F]">{name}</p>
              {r.contact?.job_title && <span className="text-[11px] text-[#6E6E73]">{r.contact.job_title}</span>}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">Email {r.sequence_step}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${scoreCls(r.qa_score)}`}><ShieldCheck size={10} /> QA {r.qa_score ?? '-'}</span>
            </div>
            <p className="text-[12px] text-[#6E6E73] flex items-center gap-1 mt-0.5"><Building2 size={11} /> {r.account?.name ?? ''} · {r.contact?.email ?? 'no email'} · {fmtDate(r.created_at)}</p>
            <p className="text-[13px] font-semibold text-[#1D1D1F] mt-2">{r.subject}</p>
            {r.fact_used && <p className="text-[11px] text-[#6E6E73] mt-0.5">Built on: <span className="italic">{r.fact_used}</span></p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {withActions && (
              <>
                <button onClick={() => setStatus(r, 'approved')} disabled={busy === r.id}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition">
                  {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
                </button>
                <button onClick={() => setStatus(r, 'rejected')} disabled={busy === r.id}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:text-rose-600 hover:border-rose-300 transition">
                  <X size={13} /> Reject
                </button>
              </>
            )}
            {r.contact && (
              <Link href={`/account-pursuit/contacts/${r.contact.id}`} className="text-[12px] text-teal-700 hover:underline inline-flex items-center gap-1">Open <ExternalLink size={11} /></Link>
            )}
          </div>
        </div>
        <button onClick={() => setOpen(isOpen ? null : r.id)} className="mt-2 text-[11px] text-[#6E6E73] hover:text-teal-700 inline-flex items-center gap-1">
          <ChevronDown size={12} className={`transition ${isOpen ? 'rotate-180' : ''}`} /> {isOpen ? 'Hide email' : 'Read the full email'}
        </button>
        {isOpen && (
          <pre className="mt-2 text-[13px] text-[#1D1D1F] whitespace-pre-wrap font-sans leading-relaxed bg-[#FAFAFA] border border-[#E5E5EA] rounded-lg p-3">{r.body}</pre>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-2.5 mb-1">
        <MailCheck size={20} className="text-teal-600" />
        <h1 className="text-[20px] font-bold text-[#1D1D1F]">Email approvals</h1>
      </div>
      <p className="text-[12px] text-[#6E6E73] mb-6">Drafts written by the agents. Nothing is sent until you approve it. Approved emails go out automatically inside the daily limit and send window.</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-teal-600" /></div>
      ) : (
        <div className="space-y-6">
          <section>
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">Needs your approval ({pending.length})</p>
            {pending.length === 0
              ? <p className="text-[12px] text-[#AEAEB2] bg-white border border-[#E5E5EA] rounded-2xl p-6 text-center">Nothing waiting. New follow-up drafts appear here when they are due.</p>
              : <div className="space-y-3">{pending.map(r => card(r, true))}</div>}
          </section>
          <section>
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">Approved, queued to send ({queued.length})</p>
            {queued.length === 0
              ? <p className="text-[12px] text-[#AEAEB2]">None.</p>
              : <div className="space-y-3">{queued.map(r => card(r, false))}</div>}
          </section>
        </div>
      )}
    </div>
  )
}
