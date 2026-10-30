import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmailDraft } from '@/lib/agents/email-pipeline'
import { LlmError, llmConfigured } from '@/lib/agents/llm'
import type { AbmAgentSettings, ResearchFact } from '@/lib/account-pursuit/types'

// Strategist → Copywriter → Critic. Saves the result to abm_drafts as
// "pending_approval" (RLS-scoped to the signed-in user). Nothing is sent here.

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: 'No free AI provider is configured yet. Add GEMINI_API_KEY (or GROQ_API_KEY / OPENROUTER_API_KEY) to the environment.' }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const instructions: string = (body.instructions || '').toString().slice(0, 400)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: contact, error } = await supabase.from('abm_contacts').select('*').eq('id', id).single()
  if (error || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  if (contact.do_not_contact) return NextResponse.json({ error: 'This contact is marked Do Not Contact.' }, { status: 400 })
  if (!contact.email) return NextResponse.json({ error: 'No email address on file for this contact. Add one under Contact info first.' }, { status: 400 })

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [{ data: account }, { data: messages }, { data: offer }, { data: settingsRow }, { data: accDrafts }, { data: allDrafts }, { data: sentEmails }, { data: researchRows }] = await Promise.all([
    supabase.from('abm_accounts').select('*').eq('id', contact.account_id).single(),
    supabase.from('abm_messages').select('direction, channel, body, occurred_at').eq('contact_id', id).order('occurred_at', { ascending: true }),
    supabase.from('abm_offer_context').select('*').eq('id', 1).single(),
    supabase.from('abm_agent_settings').select('*').eq('id', 1).single(),
    supabase.from('abm_drafts').select('body, angle, variant').eq('account_id', contact.account_id).order('created_at', { ascending: false }).limit(8),
    supabase.from('abm_drafts').select('body').order('created_at', { ascending: false }).limit(40),
    supabase.from('abm_messages').select('body').eq('channel', 'email').eq('direction', 'sent').order('occurred_at', { ascending: false }).limit(40),
    supabase.from('abm_research').select('facts, contact_id, created_at').eq('account_id', contact.account_id).gte('created_at', since).order('created_at', { ascending: false }).limit(6),
  ])

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (!settingsRow) return NextResponse.json({ error: 'Agent settings missing. Run supabase/account_pursuit_agents_migration.sql first.' }, { status: 500 })
  const settings = settingsRow as AbmAgentSettings

  // Verified research: firm facts from any recent run for this account, person facts only for THIS contact.
  const research: ResearchFact[] = []
  const seenClaims = new Set<string>()
  for (const row of (researchRows ?? []) as { facts: ResearchFact[]; contact_id: string | null }[]) {
    for (const f of row.facts ?? []) {
      if (f.subject === 'contact' && row.contact_id !== contact.id) continue
      const k = f.claim.toLowerCase()
      if (seenClaims.has(k)) continue
      seenClaims.add(k)
      research.push(f)
    }
  }

  const emailsSentToContact = (messages ?? []).filter((m: { channel: string; direction: string }) => m.channel === 'email' && m.direction === 'sent').length
  const step = Math.min(3, Math.max(1, Number(body.step) || emailsSentToContact + 1))

  const thread = (messages ?? []).map((m: { direction: string; channel: string; body: string }) =>
    `${m.direction === 'sent' ? 'US' : 'THEM'} (${m.channel}): ${m.body}`).join('\n')

  try {
    const r = await generateEmailDraft({
      account, contact, settings, offer, thread, step, instructions, research,
      recentDrafts: (accDrafts ?? []) as { body: string; angle: string | null; variant: Record<string, unknown> | null }[],
      corpusBodies: [
        ...((allDrafts ?? []) as { body: string }[]).map(d => d.body),
        ...((sentEmails ?? []) as { body: string }[]).map(d => d.body),
      ],
    })

    const { data: draft, error: insErr } = await supabase.from('abm_drafts').insert({
      contact_id: contact.id,
      account_id: contact.account_id,
      owner_id: contact.owner_id ?? user.id,
      channel: 'email',
      sequence_step: step,
      subject: r.subject,
      body: r.body,
      status: 'pending_approval',
      angle: r.brief.fact?.key ?? null,
      fact_used: r.brief.fact?.text ?? null,
      variant: r.brief.variant,
      qa_score: r.qa.score,
      qa_notes: { issues: r.qa.issues, warnings: r.qa.warnings },
      model: `${r.provider}/${r.model}`,
    }).select('*').single()

    if (insErr) return NextResponse.json({ error: `Could not save draft: ${insErr.message}` }, { status: 500 })
    return NextResponse.json({ draft, attempts: r.attempts })
  } catch (e) {
    const msg = e instanceof LlmError ? e.message : 'Draft generation failed. Try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
