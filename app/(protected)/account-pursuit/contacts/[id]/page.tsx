'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, ExternalLink, Send, Save, Building2, Clock, CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getViewer, businessDaysFromToday, fmtDate, dueLabel, fullName } from '@/lib/account-pursuit/helpers'
import {
  CONNECTION_STATUSES, CONVERSATION_STAGES, CHANNELS, COMMITTEE_ROLES, NEXT_STEP_PRESETS,
} from '@/lib/account-pursuit/constants'
import { RoleBadge } from '@/components/account-pursuit/badges'
import type {
  AbmAccount, AbmContact, AbmMessage, AbmTemplate,
  ConnectionStatus, ConversationStage, Channel, Direction,
} from '@/lib/account-pursuit/types'

const input = 'w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[13px] text-[#1D1D1F] focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 transition bg-white'
const label = 'text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1 block'

export default function ContactThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [contact, setContact] = useState<AbmContact | null>(null)
  const [account, setAccount] = useState<AbmAccount | null>(null)
  const [messages, setMessages] = useState<AbmMessage[]>([])
  const [templates, setTemplates] = useState<AbmTemplate[]>([])
  const [viewer, setViewer] = useState<{ id: string; isManager: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  // compose state
  const [direction, setDirection] = useState<Direction>('sent')
  const [channel, setChannel] = useState<Channel>('dm')
  const [body, setBody] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [logging, setLogging] = useState(false)

  // next-step editor
  const [nextAction, setNextAction] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [savingStep, setSavingStep] = useState(false)

  const loadMessages = useCallback(async (contactId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('abm_messages').select('*').eq('contact_id', contactId).order('occurred_at', { ascending: true })
    setMessages((data as AbmMessage[]) ?? [])
  }, [])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: c, error } = await supabase.from('abm_contacts').select('*').eq('id', id).single()
    if (error || !c) { router.push('/account-pursuit/accounts'); return }
    const contactRow = c as AbmContact
    setContact(contactRow)
    setNextAction(contactRow.next_action ?? '')
    setNextDate(contactRow.next_action_date ?? '')
    const [{ data: acct }, , { data: tpls }] = await Promise.all([
      supabase.from('abm_accounts').select('*').eq('id', contactRow.account_id).single(),
      loadMessages(contactRow.id),
      supabase.from('abm_message_templates').select('*').eq('is_active', true).order('name'),
    ])
    setAccount((acct as AbmAccount) ?? null)
    setTemplates((tpls as AbmTemplate[]) ?? [])
    setLoading(false)
  }, [id, router, loadMessages])

  useEffect(() => { getViewer().then(setViewer); load() }, [load])

  async function patchContact(fields: Partial<AbmContact>) {
    if (!contact) return
    setContact({ ...contact, ...fields })
    const supabase = createClient()
    await supabase.from('abm_contacts').update(fields).eq('id', contact.id)
  }

  async function changeConnection(status: ConnectionStatus) {
    const now = new Date().toISOString()
    const fields: Partial<AbmContact> = { connection_status: status }
    if (status === 'request_sent' && !contact?.request_sent_at) fields.request_sent_at = now
    if (status === 'accepted' && !contact?.connected_at) {
      fields.connected_at = now
      if (!contact?.next_action) { fields.next_action = 'Send opener message'; fields.next_action_date = businessDaysFromToday(1) }
    }
    await patchContact(fields)
  }

  async function saveNextStep() {
    setSavingStep(true)
    await patchContact({ next_action: nextAction.trim() || null, next_action_date: nextDate || null })
    setSavingStep(false)
  }

  function applyTemplate(tid: string) {
    setTemplateId(tid)
    const t = templates.find(x => x.id === tid)
    if (t) { setBody(t.body); if (t.channel) setChannel(t.channel) }
  }

  async function logMessage() {
    if (!contact || !body.trim() || !viewer) return
    setLogging(true)
    const now = new Date().toISOString()
    const supabase = createClient()
    await supabase.from('abm_messages').insert({
      contact_id: contact.id, account_id: contact.account_id,
      direction, channel, body: body.trim(),
      template_id: templateId || null, logged_by: viewer.id,
    })

    // Auto-advance lifecycle/stage from the logged touch
    const cf: Partial<AbmContact> = {}
    if (direction === 'sent') {
      cf.last_touch_at = now
      cf.touch_count = (contact.touch_count ?? 0) + 1
      if (channel === 'connect_note' && contact.connection_status === 'not_sent') {
        cf.connection_status = 'request_sent'; cf.request_sent_at = now
      }
      if (channel !== 'connect_note' && contact.conversation_stage === 'no_contact') {
        cf.conversation_stage = 'opener_sent'
      }
    } else {
      if (contact.conversation_stage === 'no_contact' || contact.conversation_stage === 'opener_sent') {
        cf.conversation_stage = 'replied'
      }
    }
    await patchContact(cf)
    if (account) { await supabase.from('abm_accounts').update({ last_activity_at: now }).eq('id', account.id) }

    setBody(''); setTemplateId('')
    await loadMessages(contact.id)
    setLogging(false)
  }

  if (loading || !contact) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin text-teal-600" /></div>
  }

  const channelMeta = CHANNELS.find(c => c.value === channel)!
  const overLimit = channelMeta.limit != null && body.length > channelMeta.limit
  const due = dueLabel(contact.next_action_date)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {account && (
        <Link href={`/account-pursuit/accounts/${account.id}`} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] hover:text-teal-700 transition mb-4">
          <ArrowLeft size={14} /> {account.name}
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* LEFT: thread + compose */}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-[20px] font-bold text-[#1D1D1F] leading-tight">{fullName(contact)}</h1>
            <RoleBadge value={contact.committee_role} />
            {contact.has_mutuals && <span className="text-[11px] text-emerald-600 font-semibold">warm path</span>}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#6E6E73] mb-5 flex-wrap">
            {contact.job_title && <span>{contact.job_title}</span>}
            {account && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {account.name}</span>}
            {contact.linkedin_url && (
              <a href={contact.linkedin_url.trim()} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-600 hover:underline font-medium">
                Open LinkedIn <ExternalLink size={10} />
              </a>
            )}
          </div>

          {/* Thread */}
          <div className="bg-[#FAFAFA] border border-[#E5E5EA] rounded-2xl p-4 mb-4 min-h-[220px]">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Send size={20} className="text-[#AEAEB2] mx-auto mb-2" />
                <p className="text-[12px] text-[#AEAEB2]">No messages logged yet. Record what you send and receive below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(m => {
                  const ch = CHANNELS.find(c => c.value === m.channel)
                  const sent = m.direction === 'sent'
                  return (
                    <div key={m.id} className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${sent ? 'bg-teal-600 text-white' : 'bg-white border border-[#E5E5EA] text-[#1D1D1F]'}`}>
                        <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${sent ? 'text-teal-100' : 'text-[#AEAEB2]'}`}>
                          {ch?.label ?? m.channel} · {fmtDate(m.occurred_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Compose */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="flex rounded-lg border border-[#E5E5EA] overflow-hidden">
                {(['sent', 'received'] as Direction[]).map(d => (
                  <button key={d} onClick={() => setDirection(d)}
                    className={`px-3 py-1.5 text-[12px] font-medium transition ${direction === d ? 'bg-teal-600 text-white' : 'text-[#6E6E73] hover:bg-[#F5F5F7]'}`}>
                    {d === 'sent' ? 'I sent' : 'They replied'}
                  </button>
                ))}
              </div>
              <select value={channel} onChange={e => setChannel(e.target.value as Channel)}
                className="h-8 border border-[#E5E5EA] rounded-lg px-2 text-[12px] bg-white text-[#1D1D1F]">
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {templates.length > 0 && direction === 'sent' && (
                <select value={templateId} onChange={e => applyTemplate(e.target.value)}
                  className="h-8 border border-[#E5E5EA] rounded-lg px-2 text-[12px] bg-white text-[#6E6E73]">
                  <option value="">Insert template…</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
              placeholder={direction === 'sent' ? 'Paste or write what you sent…' : 'What did they say back…'}
              className={`w-full border rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 transition ${overLimit ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/10' : 'border-[#E5E5EA] focus:border-teal-500 focus:ring-teal-500/10'}`} />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[11px] ${overLimit ? 'text-rose-600 font-medium' : 'text-[#AEAEB2]'}`}>
                {channelMeta.limit != null ? `${body.length} / ${channelMeta.limit}` : `${body.length} chars`}
                {overLimit && ' · over LinkedIn limit'}
              </span>
              <button onClick={logMessage} disabled={logging || !body.trim() || overLimit}
                className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition">
                {logging ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Log message
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: lifecycle + next step */}
        <div className="space-y-4">
          {/* Connection lifecycle */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">Connection</p>
            <select value={contact.connection_status} onChange={e => changeConnection(e.target.value as ConnectionStatus)}
              className={`${input} font-medium`}>
              {CONNECTION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div className="mt-2 space-y-1 text-[11px] text-[#6E6E73]">
              {contact.request_sent_at && <p className="flex items-center gap-1.5"><Clock size={11} /> Requested {fmtDate(contact.request_sent_at)}</p>}
              {contact.connected_at && <p className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={11} /> Connected {fmtDate(contact.connected_at)}</p>}
            </div>
          </div>

          {/* Conversation stage */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">Conversation stage</p>
            <select value={contact.conversation_stage} onChange={e => patchContact({ conversation_stage: e.target.value as ConversationStage })}
              className={`${input} font-medium`}>
              {CONVERSATION_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <p className="text-[11px] text-[#AEAEB2] mt-2">{contact.touch_count} touch{contact.touch_count === 1 ? '' : 'es'}{contact.last_touch_at ? ` · last ${fmtDate(contact.last_touch_at)}` : ''}</p>
          </div>

          {/* Next step engine */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">Next step</p>
            {contact.next_action && (
              <p className={`text-[11px] mb-2 ${due.tone === 'overdue' ? 'text-rose-600 font-medium' : due.tone === 'today' ? 'text-amber-600 font-medium' : 'text-[#6E6E73]'}`}>
                Currently: {contact.next_action} · {due.text}
              </p>
            )}
            <input className={input + ' mb-2'} value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="e.g. Send value-add follow-up" />
            <input type="date" className={input} value={nextDate} onChange={e => setNextDate(e.target.value)} />
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {NEXT_STEP_PRESETS.map(p => (
                <button key={p.label} onClick={() => setNextDate(businessDaysFromToday(p.days))}
                  className="text-[11px] px-2 py-1 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:border-teal-400 hover:text-teal-700 transition">
                  {p.label}
                </button>
              ))}
              <button onClick={() => { setNextAction(''); setNextDate('') }}
                className="text-[11px] px-2 py-1 rounded-lg text-[#AEAEB2] hover:text-rose-600 transition">clear</button>
            </div>
            <button onClick={saveNextStep} disabled={savingStep}
              className="w-full mt-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition">
              {savingStep ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save next step
            </button>
          </div>

          {/* Role + do-not-contact */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">Committee role</p>
            <select value={contact.committee_role} onChange={e => patchContact({ committee_role: e.target.value as AbmContact['committee_role'] })}
              className={input}>
              {COMMITTEE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <label className="flex items-center gap-2 mt-3 text-[12px] text-[#6E6E73] cursor-pointer">
              <input type="checkbox" checked={contact.do_not_contact} onChange={e => patchContact({ do_not_contact: e.target.checked })} className="accent-rose-600" />
              Do not contact
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
