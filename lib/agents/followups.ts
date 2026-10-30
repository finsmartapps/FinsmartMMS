// Follow-up scheduler agent — finds people we emailed who have not replied and whose follow-up is due,
// and writes the next touch (2 or 3) into the approval queue. It NEVER sends. After the third email goes
// unanswered for a week it marks the contact Cold so the sequence ends cleanly.

import { createEmailDraft, DraftError } from './draft-service'
import { sendEmail } from '@/lib/email'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

export interface FollowupRun {
  created: { contactId: string; name: string; firm: string; step: number }[]
  markedCold: number
  skipped: number
  note: string
}

const today = () => new Date().toISOString().slice(0, 10)

export async function scheduleFollowups(db: Db, opts: { max?: number } = {}): Promise<FollowupRun> {
  const max = opts.max ?? 2
  const created: FollowupRun['created'] = []
  let skipped = 0
  let markedCold = 0

  const { data: settings } = await db.from('abm_agent_settings').select('kill_switch').eq('id', 1).single()
  if (settings?.kill_switch) return { created, markedCold, skipped, note: 'kill switch is ON, no follow-ups prepared' }

  // ── end of sequence: 3 emails, no reply, a week of silence → Cold ──
  const { data: cand } = await db.from('abm_contacts').select('id, last_touch_at')
    .eq('conversation_stage', 'opener_sent').eq('do_not_contact', false).gte('touch_count', 3)
    .lte('last_touch_at', new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(50)
  for (const c of cand ?? []) {
    const { count } = await db.from('abm_messages').select('id', { count: 'exact', head: true }).eq('contact_id', c.id).eq('channel', 'email').eq('direction', 'sent')
    if ((count ?? 0) >= 3) {
      await db.from('abm_contacts').update({ conversation_stage: 'cold', next_action: null, next_action_date: null }).eq('id', c.id)
      markedCold++
    }
  }

  // ── who is due a follow-up? ──
  const { data: due } = await db.from('abm_contacts').select('*')
    .eq('conversation_stage', 'opener_sent').eq('do_not_contact', false)
    .not('email', 'is', null).lte('next_action_date', today()).ilike('next_action', 'Follow-up email%')
    .order('next_action_date', { ascending: true }).limit(40)

  for (const c of due ?? []) {
    if (created.length >= max) break
    if (c.email_status === 'bounced') { skipped++; continue }

    const { data: sent } = await db.from('abm_messages').select('occurred_at').eq('contact_id', c.id).eq('channel', 'email').eq('direction', 'sent').order('occurred_at', { ascending: false })
    const n = sent?.length ?? 0
    if (n < 1 || n >= 3) { skipped++; continue }
    if (Date.now() - new Date(sent![0].occurred_at).getTime() < 3 * 86_400_000) { skipped++; continue }   // never nag within 3 days
    const step = n + 1

    // one draft per step per contact, ever: if a human rejected it, respect that
    const { count: existing } = await db.from('abm_drafts').select('id', { count: 'exact', head: true }).eq('contact_id', c.id).eq('sequence_step', step).eq('channel', 'email')
    if ((existing ?? 0) > 0) { skipped++; continue }

    try {
      await createEmailDraft(db, c.id, { step })
      const { data: acct } = await db.from('abm_accounts').select('name').eq('id', c.account_id).single()
      created.push({ contactId: c.id, name: `${c.first_name} ${c.last_name ?? ''}`.trim(), firm: acct?.name ?? '', step })
    } catch (e) {
      skipped++
      if (!(e instanceof DraftError)) console.error('followup draft failed', c.id, e)
    }
  }

  // one summary email per owner, only when something new needs approval
  if (created.length) {
    const { data: rows } = await db.from('abm_contacts').select('id, owner_id').in('id', created.map(x => x.contactId))
    const byOwner = new Map<string, number>()
    for (const r of rows ?? []) if (r.owner_id) byOwner.set(r.owner_id, (byOwner.get(r.owner_id) ?? 0) + 1)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finsmart-mms-hazel.vercel.app'
    for (const [ownerId, count] of byOwner) {
      const { data: owner } = await db.from('profiles').select('name, email, is_active').eq('id', ownerId).single()
      if (!owner?.email || owner.is_active === false) continue
      const list = created.map(x => `<li style="margin:3px 0;">${x.name}${x.firm ? ` <span style="color:#888;">· ${x.firm}</span>` : ''} <span style="color:#888;">(email ${x.step})</span></li>`).join('')
      try {
        await sendEmail({
          to: owner.email,
          subject: `${count} follow-up draft${count === 1 ? '' : 's'} ready for your approval`,
          html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="font-size:17px;color:#0d9488;">${count} follow-up draft${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} your approval</h2>
            <p style="font-size:13px;color:#555;">These people were emailed earlier and have not replied. Nothing is sent until you approve.</p>
            <ul style="font-size:13px;color:#222;padding-left:18px;">${list}</ul>
            <p style="margin-top:14px;"><a href="${appUrl}/account-pursuit/drafts" style="background:#0d9488;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;">Review and approve</a></p>
          </div>`,
        })
      } catch { /* alert is best-effort */ }
    }
  }

  return { created, markedCold, skipped, note: created.length ? `${created.length} follow-up draft${created.length === 1 ? '' : 's'} created` : 'no follow-ups due' }
}
