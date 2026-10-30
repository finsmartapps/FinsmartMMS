// Sender agent — sends APPROVED email drafts, politely and within limits:
//   daily cap · local send window (weekdays) · kill switch · one email per firm per day ·
//   no follow-up to anyone who replied · follow-ups thread under the first email.
// Runs from the cron endpoint (a few per run, spread over the day) or "Send now" on a single draft.

import { sendPlain, mailerConfigured } from './mailer'
import { localClock } from './clock'
import type { AbmAgentSettings } from '@/lib/account-pursuit/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

export interface SendOutcome { draftId: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }
export interface SendRun { sent: number; remainingToday: number; note: string; outcomes: SendOutcome[] }

function addBusinessDays(days: number): string {
  const d = new Date()
  let n = 0
  while (n < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++ }
  return d.toISOString().slice(0, 10)
}

// Split "subject line" and body — the draft stores greeting + body + signature in `body`.
const stripRe = (s: string) => s.replace(/^(re|fwd?):\s*/i, '').trim()

export async function warmupCap(db: Db, base: number): Promise<number> {
  const { data } = await db.from('abm_drafts').select('sent_at').eq('status', 'sent').order('sent_at', { ascending: true }).limit(1)
  const first = data?.[0]?.sent_at
  if (!first) return Math.min(base, 5)
  const days = Math.floor((Date.now() - new Date(first).getTime()) / 86_400_000)
  const ramp = days < 7 ? 5 : days < 14 ? 10 : days < 21 ? 15 : 20
  return Math.min(base, ramp)
}

async function sentTodayCount(db: Db, startISO: string): Promise<number> {
  const { count } = await db.from('abm_drafts').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', startISO)
  return count ?? 0
}

async function deliverOne(db: Db, draft: any, settings: AbmAgentSettings, startISO: string): Promise<SendOutcome> {
  const fail = async (reason: string, status: 'failed' | 'rejected' = 'failed'): Promise<SendOutcome> => {
    await db.from('abm_drafts').update({ status, send_error: reason }).eq('id', draft.id)
    return { draftId: draft.id, status: status === 'failed' ? 'failed' : 'skipped', reason }
  }

  const { data: contact } = await db.from('abm_contacts').select('*').eq('id', draft.contact_id).single()
  if (!contact) return fail('contact no longer exists')
  if (contact.do_not_contact) return fail('contact is marked Do Not Contact', 'rejected')
  const to = (contact.email ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return fail('no valid email address on file')

  // never keep emailing someone who is already talking to us
  if (draft.sequence_step > 1 && ['replied', 'in_conversation', 'meeting_booked'].includes(contact.conversation_stage)) {
    return fail('contact already replied, follow-up cancelled', 'rejected')
  }

  // one email per firm per day (don't land 4 emails in one firm's inbox at once)
  const { count: sameFirmToday } = await db.from('abm_drafts').select('id', { count: 'exact', head: true })
    .eq('status', 'sent').eq('account_id', draft.account_id).gte('sent_at', startISO)
  if ((sameFirmToday ?? 0) > 0) return { draftId: draft.id, status: 'skipped', reason: 'already emailed this firm today, will retry tomorrow' }

  // follow-ups thread under the first email
  let subject = (draft.subject ?? '').trim() || 'Quick question'
  let inReplyTo: string | null = null
  let references: string[] = []
  if (draft.sequence_step > 1) {
    const { data: prev } = await db.from('abm_messages').select('subject, rfc_message_id')
      .eq('contact_id', contact.id).eq('channel', 'email').eq('direction', 'sent')
      .not('rfc_message_id', 'is', null).order('occurred_at', { ascending: false }).limit(1)
    if (prev?.[0]?.rfc_message_id) {
      inReplyTo = prev[0].rfc_message_id
      references = [prev[0].rfc_message_id]
      if (prev[0].subject) subject = `Re: ${stripRe(prev[0].subject)}`
    }
  }

  let messageId = ''
  try {
    const r = await sendPlain({ to, subject, text: draft.body, fromName: settings.sender_name, inReplyTo, references })
    messageId = r.messageId
  } catch (e) {
    return fail(`SMTP error: ${(e as Error).message.slice(0, 200)}`)
  }

  const now = new Date().toISOString()
  await db.from('abm_drafts').update({ status: 'sent', sent_at: now, rfc_message_id: messageId, send_error: null }).eq('id', draft.id)
  await db.from('abm_messages').insert({
    contact_id: contact.id, account_id: contact.account_id, direction: 'sent', channel: 'email',
    body: draft.body, subject, rfc_message_id: messageId, draft_id: draft.id, occurred_at: now, logged_by: draft.approved_by ?? null,
  })

  const step = draft.sequence_step as number
  const patch: Record<string, unknown> = {
    last_touch_at: now,
    touch_count: (contact.touch_count ?? 0) + 1,
    next_action: step < 3 ? `Follow-up email (touch ${step + 1})` : 'Mark cold if no reply',
    next_action_date: addBusinessDays(step === 1 ? 4 : 5),
  }
  if (contact.conversation_stage === 'no_contact') patch.conversation_stage = 'opener_sent'
  await db.from('abm_contacts').update(patch).eq('id', contact.id)
  await db.from('abm_accounts').update({ last_activity_at: now }).eq('id', contact.account_id)
  await db.from('abm_accounts').update({ status: 'engaged' }).eq('id', contact.account_id).eq('status', 'target')

  return { draftId: draft.id, status: 'sent' }
}

export async function sendApprovedDrafts(db: Db, opts: { limit?: number; draftId?: string; ignoreWindow?: boolean } = {}): Promise<SendRun> {
  const { data: settings } = await db.from('abm_agent_settings').select('*').eq('id', 1).single()
  if (!settings) return { sent: 0, remainingToday: 0, note: 'agent settings missing, run the migration', outcomes: [] }
  if (settings.kill_switch) return { sent: 0, remainingToday: 0, note: 'kill switch is ON, nothing sends', outcomes: [] }
  if (!mailerConfigured()) return { sent: 0, remainingToday: 0, note: 'outreach mailbox not configured (ABM_SMTP_*)', outcomes: [] }

  const clock = localClock(settings.timezone)
  if (!opts.ignoreWindow) {
    if (clock.isWeekend) return { sent: 0, remainingToday: 0, note: `weekend in ${settings.timezone}, not sending`, outcomes: [] }
    if (clock.hour < settings.send_start_hour || clock.hour >= settings.send_end_hour) {
      return { sent: 0, remainingToday: 0, note: `outside send window (${settings.send_start_hour}:00-${settings.send_end_hour}:00 ${settings.timezone})`, outcomes: [] }
    }
  }

  // Warm-up: a new sending domain has no reputation, so ramp 5 -> 10 -> 15 -> up to the configured cap by week.
  const cap = await warmupCap(db, settings.daily_cap)
  const already = await sentTodayCount(db, clock.startOfDayISO)
  const remaining = Math.max(0, cap - already)
  if (remaining === 0) return { sent: 0, remainingToday: 0, note: `daily cap of ${cap} reached${cap < settings.daily_cap ? ' (warm-up limit, it rises each week)' : ''}`, outcomes: [] }

  let q = db.from('abm_drafts').select('*').eq('status', 'approved').eq('channel', 'email').order('approved_at', { ascending: true })
  if (opts.draftId) q = q.eq('id', opts.draftId)
  const { data: drafts } = await q.limit(Math.min(remaining, opts.limit ?? 2))

  const outcomes: SendOutcome[] = []
  for (const d of drafts ?? []) outcomes.push(await deliverOne(db, d, settings as AbmAgentSettings, clock.startOfDayISO))
  const sent = outcomes.filter(o => o.status === 'sent').length
  return { sent, remainingToday: remaining - sent, note: outcomes.length ? 'ok' : 'no approved drafts waiting', outcomes }
}
