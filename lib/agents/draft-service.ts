// Shared "make one email draft" service: used by the Write-email-draft button (user session)
// and by the follow-up scheduler (service role). Runs Strategist → Copywriter → Critic and saves
// the result to abm_drafts as "pending_approval". It NEVER sends anything.

import { generateEmailDraft } from './email-pipeline'
import type { AbmAgentSettings, ResearchFact } from '@/lib/account-pursuit/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

export class DraftError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

const stripRe = (s: string) => s.replace(/^(re|fwd?):\s*/i, '').trim()

export async function createEmailDraft(
  db: Db,
  contactId: string,
  opts: { step?: number; instructions?: string; userId?: string | null } = {},
): Promise<{ draft: any; attempts: number }> {
  const { data: contact, error } = await db.from('abm_contacts').select('*').eq('id', contactId).single()
  if (error || !contact) throw new DraftError('Contact not found', 404)
  if (contact.do_not_contact) throw new DraftError('This contact is marked Do Not Contact.')
  if (contact.email_status === 'bounced') throw new DraftError('This address bounced earlier. Add a working email first.')
  if (!contact.email) throw new DraftError('No email address on file for this contact. Add one under Contact info first.')

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [{ data: account }, { data: messages }, { data: offer }, { data: settingsRow }, { data: accDrafts }, { data: allDrafts }, { data: sentEmails }, { data: researchRows }] = await Promise.all([
    db.from('abm_accounts').select('*').eq('id', contact.account_id).single(),
    db.from('abm_messages').select('direction, channel, body, subject, occurred_at').eq('contact_id', contactId).order('occurred_at', { ascending: true }),
    db.from('abm_offer_context').select('*').eq('id', 1).single(),
    db.from('abm_agent_settings').select('*').eq('id', 1).single(),
    db.from('abm_drafts').select('body, angle, variant').eq('account_id', contact.account_id).order('created_at', { ascending: false }).limit(8),
    db.from('abm_drafts').select('body').order('created_at', { ascending: false }).limit(40),
    db.from('abm_messages').select('body').eq('channel', 'email').eq('direction', 'sent').order('occurred_at', { ascending: false }).limit(40),
    db.from('abm_research').select('facts, contact_id, created_at').eq('account_id', contact.account_id).gte('created_at', since).order('created_at', { ascending: false }).limit(6),
  ])
  if (!account) throw new DraftError('Account not found', 404)
  if (!settingsRow) throw new DraftError('Agent settings missing. Run supabase/account_pursuit_agents_migration.sql first.', 500)
  const settings = settingsRow as AbmAgentSettings

  // Verified research: firm facts from any recent run for this account, person facts only for THIS contact.
  const research: ResearchFact[] = []
  const seenClaims = new Set<string>()
  for (const row of (researchRows ?? []) as { facts: ResearchFact[]; contact_id: string | null }[]) {
    for (const f of row.facts ?? []) {
      if (f.subject === 'contact' && row.contact_id !== contactId) continue
      const k = f.claim.toLowerCase()
      if (seenClaims.has(k)) continue
      seenClaims.add(k)
      research.push(f)
    }
  }

  const emailsSent = (messages ?? []).filter((m: any) => m.channel === 'email' && m.direction === 'sent')
  const step = Math.min(3, Math.max(1, Number(opts.step) || emailsSent.length + 1))
  const thread = (messages ?? []).map((m: any) => `${m.direction === 'sent' ? 'US' : 'THEM'} (${m.channel}): ${m.body}`).join('\n')

  let r
  try {
    r = await generateEmailDraft({
      account, contact, settings, offer, thread, step, instructions: opts.instructions, research,
      recentDrafts: (accDrafts ?? []) as any[],
      corpusBodies: [...((allDrafts ?? []) as any[]).map(d => d.body), ...((sentEmails ?? []) as any[]).map(d => d.body)],
    })
  } catch (e) {
    throw new DraftError(e instanceof Error ? e.message : 'Draft generation failed.', 502)
  }

  // Follow-ups reply inside the first email's thread, so show the same "Re:" subject the sender will use.
  const firstSubject = emailsSent.find((m: any) => m.subject)?.subject as string | undefined
  const subject = step > 1 && firstSubject ? `Re: ${stripRe(firstSubject)}` : r.subject

  const { data: draft, error: insErr } = await db.from('abm_drafts').insert({
    contact_id: contact.id,
    account_id: contact.account_id,
    owner_id: contact.owner_id ?? opts.userId ?? null,
    channel: 'email',
    sequence_step: step,
    subject,
    body: r.body,
    status: 'pending_approval',
    angle: r.brief.fact?.key ?? null,
    fact_used: r.brief.fact?.text ?? null,
    variant: r.brief.variant,
    qa_score: r.qa.score,
    qa_notes: { issues: r.qa.issues, warnings: r.qa.warnings },
    model: `${r.provider}/${r.model}`,
  }).select('*').single()
  if (insErr) throw new DraftError(`Could not save draft: ${insErr.message}`, 500)
  return { draft, attempts: r.attempts }
}
