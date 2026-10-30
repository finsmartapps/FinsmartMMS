// Reply Watcher agent — reads the outreach mailbox over IMAP (Inbox + Spam), keeps ONLY messages that
// answer something we sent (matched by In-Reply-To / References, a bounce naming a recipient, or a known
// contact who has been emailed), classifies them, and updates the contact, account and any queued follow-ups.
// It never marks anything read, deletes or moves mail.

import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { classifyReply, type ReplyClass, type RawReply } from './reply-classifier'
import { sendEmail } from '@/lib/email'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

export interface ReplyItem {
  contactId: string
  contactName: string
  firm: string
  cls: ReplyClass
  summary: string
  subject: string
}
export interface ReplyRun { scanned: number; matched: number; items: ReplyItem[]; note: string }

export function imapConfigured(): boolean {
  return !!(process.env.ABM_SMTP_USER && process.env.ABM_SMTP_PASS)
}

function addBusinessDays(days: number): string {
  const d = new Date()
  let n = 0
  while (n < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++ }
  return d.toISOString().slice(0, 10)
}
const today = () => new Date().toISOString().slice(0, 10)

// Keep only what the person actually wrote: drop quoted history and signatures' "On ... wrote:" tails.
export function stripQuoted(raw: string): string {
  const t = raw.replace(/\r/g, '')
  const cut = t.search(/\n\s*(On [\s\S]{5,220}?wrote:|-{2,}\s*(Original Message|Forwarded message)|From:\s.+\nSent:\s.+|_{8,})/i)
  const body = (cut >= 0 ? t.slice(0, cut) : t).split('\n').filter(l => !/^\s*>/.test(l)).join('\n')
  return body.trim().slice(0, 4000)
}

function textOf(p: ParsedMail): string {
  if (p.text) return p.text
  if (p.html) return String(p.html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ')
  return ''
}

async function findContactForMessage(db: Db, p: ParsedMail, isDsn: boolean, fromAddr: string): Promise<{ id: string } | null> {
  // 1. proper threading: they replied to one of our message ids
  const refs = [p.inReplyTo, ...(Array.isArray(p.references) ? p.references : p.references ? [p.references] : [])].filter(Boolean) as string[]
  if (refs.length) {
    const { data } = await db.from('abm_messages').select('contact_id').in('rfc_message_id', refs).eq('direction', 'sent').limit(1)
    if (data?.[0]) return { id: data[0].contact_id }
  }
  // 2. a bounce: find which emailed contact it names
  if (isDsn) {
    const body = `${p.text ?? ''} ${p.html ?? ''}`
    const emails = [...new Set((body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map(e => e.toLowerCase()))].slice(0, 12)
    if (emails.length) {
      const { data } = await db.from('abm_contacts').select('id, email').in('email', emails).limit(5)
      for (const c of data ?? []) {
        const { count } = await db.from('abm_messages').select('id', { count: 'exact', head: true }).eq('contact_id', c.id).eq('direction', 'sent').eq('channel', 'email')
        if ((count ?? 0) > 0) return { id: c.id }
      }
    }
    return null
  }
  // 3. a contact we have emailed writes from their own address (new thread / lost headers)
  if (fromAddr) {
    const { data } = await db.from('abm_contacts').select('id').ilike('email', fromAddr).limit(1)
    if (data?.[0]) {
      const { count } = await db.from('abm_messages').select('id', { count: 'exact', head: true }).eq('contact_id', data[0].id).eq('direction', 'sent').eq('channel', 'email')
      if ((count ?? 0) > 0) return { id: data[0].id }
    }
  }
  return null
}

async function applyReply(db: Db, contact: any, account: any, cls: ReplyClass, text: string, subject: string, summary: string, messageId: string, when: Date): Promise<void> {
  const now = new Date().toISOString()
  await db.from('abm_messages').insert({
    contact_id: contact.id, account_id: contact.account_id, direction: 'received', channel: 'email',
    body: text || '(empty reply)', subject, rfc_message_id: messageId, occurred_at: when.toISOString(),
    classification: cls, summary,
  })

  const patch: Record<string, unknown> = {}
  const human = !['bounce', 'out_of_office'].includes(cls)
  switch (cls) {
    case 'bounce':
      patch.email_status = 'bounced'; patch.next_action = 'Email bounced, find a new address'; patch.next_action_date = today(); break
    case 'out_of_office':
      patch.next_action = 'Follow up after their out-of-office'; patch.next_action_date = addBusinessDays(5); break
    case 'unsubscribe':
    case 'not_interested':
      patch.do_not_contact = true; patch.conversation_stage = 'cold'; patch.next_action = null; patch.next_action_date = null; break
    case 'not_now':
      patch.conversation_stage = 'replied'; patch.next_action = 'Re-engage (they said not now)'; patch.next_action_date = addBusinessDays(30); break
    case 'interested':
      patch.conversation_stage = 'in_conversation'; patch.next_action = 'Reply today, they are interested'; patch.next_action_date = today(); break
    case 'question':
      patch.conversation_stage = 'replied'; patch.next_action = 'Answer their question'; patch.next_action_date = today(); break
    case 'referral':
      patch.conversation_stage = 'replied'; patch.next_action = 'Follow up with the person they referred'; patch.next_action_date = today(); break
    default:
      patch.conversation_stage = 'replied'; patch.next_action = 'Read and respond to their reply'; patch.next_action_date = today()
  }
  if (human) patch.last_touch_at = now
  await db.from('abm_contacts').update(patch).eq('id', contact.id)

  // nothing automated may go out to someone who replied, declined, or bounced
  if (cls !== 'out_of_office') {
    await db.from('abm_drafts').update({ status: 'rejected', send_error: `cancelled: ${cls.replace('_', ' ')} received` })
      .eq('contact_id', contact.id).in('status', ['pending_approval', 'approved'])
  }

  if (human) {
    await db.from('abm_accounts').update({ last_activity_at: now }).eq('id', contact.account_id)
    if (cls === 'interested') await db.from('abm_accounts').update({ status: 'in_conversation' }).eq('id', contact.account_id).in('status', ['target', 'engaged'])
    else if (!['not_interested', 'unsubscribe'].includes(cls)) await db.from('abm_accounts').update({ status: 'engaged' }).eq('id', contact.account_id).eq('status', 'target')
  }
}

async function alertOwner(db: Db, contact: any, accountName: string, cls: ReplyClass, summary: string, subject: string): Promise<void> {
  const { data: owner } = await db.from('profiles').select('name, email, is_active').eq('id', contact.owner_id).single()
  if (!owner?.email || owner.is_active === false) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finsmart-mms-hazel.vercel.app'
  const label = ({ interested: 'is INTERESTED', question: 'asked a question', referral: 'pointed you to someone else', other: 'replied' } as Record<string, string>)[cls] ?? 'replied'
  const name = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
    <h2 style="font-size:17px;color:#0d9488;">${name} ${label}</h2>
    <p style="font-size:13px;color:#555;margin:0 0 6px;">${accountName} · re: ${subject.replace(/</g, '&lt;')}</p>
    <p style="font-size:14px;color:#222;background:#f4fbfa;border-left:3px solid #0d9488;padding:10px 12px;">${summary.replace(/</g, '&lt;')}</p>
    <p style="margin-top:14px;"><a href="${appUrl}/account-pursuit/contacts/${contact.id}" style="background:#0d9488;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;">Open the conversation</a></p>
  </div>`
  try { await sendEmail({ to: owner.email, subject: `${name} ${label}`, html }) } catch { /* alert is best-effort */ }
}

export async function checkReplies(db: Db, opts: { max?: number } = {}): Promise<ReplyRun> {
  if (!imapConfigured()) return { scanned: 0, matched: 0, items: [], note: 'outreach mailbox not configured (ABM_SMTP_USER / ABM_SMTP_PASS)' }
  const ourEmail = (process.env.ABM_SMTP_USER as string).toLowerCase()

  const { data: settings } = await db.from('abm_agent_settings').select('last_mail_check').eq('id', 1).single()
  const since = settings?.last_mail_check ? new Date(new Date(settings.last_mail_check).getTime() - 6 * 3600_000) : new Date(Date.now() - 7 * 86_400_000)

  const client = new ImapFlow({
    host: process.env.ABM_IMAP_HOST || 'imap.secureserver.net',
    port: Number(process.env.ABM_IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.ABM_SMTP_USER as string, pass: process.env.ABM_SMTP_PASS as string },
    logger: false, socketTimeout: 25_000, greetingTimeout: 15_000,
  })

  const items: ReplyItem[] = []
  let scanned = 0
  let matched = 0
  try {
    await client.connect()
    const boxes = await client.list()
    const junk = boxes.find(b => b.specialUse === '\\Junk')?.path
    const folders = ['INBOX', ...(junk ? [junk] : [])]

    for (const folder of folders) {
      const lock = await client.getMailboxLock(folder, { readOnly: true })
      try {
        const uids = (await client.search({ since })) || []
        for (const uid of uids.slice(-(opts.max ?? 40))) {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
          if (!msg || !msg.source) continue
          scanned++
          const p = await simpleParser(msg.source)
          const messageId = (p.messageId ?? '').trim()
          const fromAddr = (p.from?.value?.[0]?.address ?? '').toLowerCase()
          if (!messageId || !fromAddr || fromAddr === ourEmail) continue

          const { count: seen } = await db.from('abm_messages').select('id', { count: 'exact', head: true }).eq('rfc_message_id', messageId)
          if ((seen ?? 0) > 0) continue

          const ctype = String((p.headers.get('content-type') as any)?.value ?? '')
          const isDsn = /multipart\/report/i.test(ctype) || /^(mailer-daemon|postmaster)@/i.test(fromAddr)
          const hit = await findContactForMessage(db, p, isDsn, fromAddr)
          if (!hit) continue
          matched++

          const { data: contact } = await db.from('abm_contacts').select('*').eq('id', hit.id).single()
          if (!contact) continue
          const { data: account } = await db.from('abm_accounts').select('name').eq('id', contact.account_id).single()

          const subject = (p.subject ?? '').trim()
          const cleaned = isDsn ? textOf(p).slice(0, 600).trim() : stripQuoted(textOf(p))
          const raw: RawReply = { from: fromAddr, subject, text: cleaned, headers: p.headers as unknown as Map<string, unknown>, isDsn }
          const result = await classifyReply(raw, ourEmail)

          await applyReply(db, contact, account, result.class, cleaned, subject, result.summary, messageId, p.date ?? new Date())
          if (['interested', 'question', 'referral', 'other'].includes(result.class)) {
            await alertOwner(db, contact, account?.name ?? '', result.class, result.summary, subject)
          }
          items.push({ contactId: contact.id, contactName: `${contact.first_name} ${contact.last_name ?? ''}`.trim(), firm: account?.name ?? '', cls: result.class, summary: result.summary, subject })
        }
      } finally { lock.release() }
    }
    await client.logout()
  } catch (e) {
    try { await client.close() } catch { /* ignore */ }
    return { scanned, matched, items, note: `mailbox error: ${(e as Error).message.slice(0, 160)}` }
  }

  await db.from('abm_agent_settings').update({ last_mail_check: new Date().toISOString() }).eq('id', 1)
  return { scanned, matched, items, note: items.length ? `${items.length} new repl${items.length === 1 ? 'y' : 'ies'} processed` : 'no new replies' }
}
