import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { llmJson, llmConfigured, LlmError } from '@/lib/agents/llm'

// AI "draft next message" (LinkedIn notes/DMs) — reads the account/contact/thread + offer
// context (RLS-scoped to the signed-in user) and asks the free LLM wrapper for options.

export const maxDuration = 60

const CHANNEL_LABEL: Record<string, string> = {
  connect_note: 'LinkedIn connection request note',
  dm: 'LinkedIn direct message',
  inmail: 'LinkedIn InMail',
  email: 'email',
}
const CHANNEL_LIMIT: Record<string, number | null> = {
  connect_note: 300, dm: null, inmail: null, email: null,
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: 'AI drafting is not configured yet. Add GEMINI_API_KEY (free) in your environment.' }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const channel: string = body.channel || 'dm'
  const intent: string = body.intent || 'auto'
  const instructions: string = (body.instructions || '').toString().slice(0, 500)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS ensures the user can only read contacts they own (or all, if manager).
  const { data: contact, error } = await supabase.from('abm_contacts').select('*').eq('id', id).single()
  if (error || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const [{ data: account }, { data: messages }, { data: offer }] = await Promise.all([
    supabase.from('abm_accounts').select('*').eq('id', contact.account_id).single(),
    supabase.from('abm_messages').select('direction, channel, body, occurred_at').eq('contact_id', id).order('occurred_at', { ascending: true }),
    supabase.from('abm_offer_context').select('*').eq('id', 1).single(),
  ])

  const limit = CHANNEL_LIMIT[channel]
  const thread = (messages ?? []).map((m: { direction: string; channel: string; body: string }) =>
    `${m.direction === 'sent' ? 'US' : 'THEM'} (${m.channel}): ${m.body}`).join('\n') || '(no messages yet)'

  const contactName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()

  const system = `You are an elite B2B account-based-marketing SDR writing LinkedIn/email outreach on behalf of the seller described below. You write concise, human, peer-to-peer messages that earn a reply. You never sound like a mass template. Match the seller's tone.

OUTREACH PHILOSOPHY — relationship first, sell later (follow this strictly):
- This is long-game account-based outreach. The goal of the EARLY messages is to start a genuine human conversation and exchange ideas — NOT to sell, qualify, or book a meeting.
- NEVER pitch the offer, name the product/service, describe what the seller does, or ask a "do you need X" style qualifying/discovery question in the first touches. That reads as selling and kills the relationship.
- Early messages should sound like one peer reaching out to another: reference something real about them or their firm, share a light relevant observation, be genuinely curious about THEIR world. If you ask a question, it must be about their experience/perspective — never a veiled sales probe.
- The offer only enters the conversation LATER, once rapport exists and they have shown interest. Even then, keep it soft.
- Use the SELLER OFFER below only as private background to stay relevant — do not surface it in early messages.

SELLER OFFER (background only — do not pitch this early)
Value proposition: ${offer?.value_prop ?? 'N/A'}
Ideal customer: ${offer?.icp ?? 'N/A'}
Tone to use: ${offer?.tone ?? 'warm, concise, value-first'}`

  const phaseGuidance = (() => {
    if (channel === 'connect_note' || contact.connection_status !== 'accepted') {
      return 'PHASE — Connection request: goal is simply to get accepted. A warm, specific, human reason to connect. NO pitch, NO product, NO ask, NO question about their needs.'
    }
    const stage = contact.conversation_stage
    if (stage === 'no_contact' || stage === 'opener_sent') {
      return 'PHASE — First message after connecting: goal is ONLY to open a genuine conversation and build rapport. Absolutely NO pitch, NO mention of the seller\'s product/service, NO qualifying/discovery question. Reference something real about them or their firm, share a light relevant thought, and optionally ask ONE genuine, low-pressure question about THEIR experience or perspective (never about whether they need what we sell). Success = a friendly reply, not a meeting.'
    }
    if (stage === 'replied' || stage === 'in_conversation') {
      return 'PHASE — Live conversation: keep it peer-to-peer and curiosity-led. You may go a little deeper into their world and share a genuinely useful insight, but still do NOT pitch or ask for a meeting unless THEY have signalled interest.'
    }
    if (stage === 'meeting_booked') {
      return 'PHASE — Meeting booked: a brief, warm confirmation or a helpful note ahead of the meeting. No hard selling.'
    }
    return 'PHASE — Re-engagement: a light, no-pressure touch to revive the conversation. No pitch.'
  })()

  const rules = [
    `Channel: ${CHANNEL_LABEL[channel] ?? channel}.`,
    limit ? `HARD LIMIT: each draft must be at most ${limit} characters.` : `Keep it tight — a few short sentences, not a wall of text.`,
    contact.has_mutuals ? 'They share mutual connections — a warm-path reference is appropriate.' : 'No mutual connections — do not fabricate one.',
    intent !== 'auto' ? `Message intent requested by the user: ${intent}. (Still respect the relationship-first philosophy.)` : phaseGuidance,
    instructions ? `Extra instruction from the user: ${instructions}` : '',
    'Do NOT invent facts about the prospect or their firm beyond what is given.',
    'Return ONLY strict JSON: {"drafts":["...","...","..."]} with exactly 3 options, no commentary, no markdown.',
  ].filter(Boolean).join('\n')

  const userMsg = `TARGET ACCOUNT
Name: ${account?.name ?? 'N/A'}
Industry: ${account?.industry ?? 'N/A'} | Angle to pitch: ${account?.targeted_industry ?? 'N/A'}
Compelling event: ${account?.compelling_event ?? 'none noted'}
Pain hypothesis: ${account?.pain_hypothesis ?? 'none noted'}
Offshore presence: ${account?.offshore_presence ?? 'unknown'}

CONTACT
${contactName} — ${contact.job_title ?? 'role unknown'} (committee role: ${contact.committee_role})
Connection: ${contact.connection_status} | Conversation stage: ${contact.conversation_stage}

CONVERSATION SO FAR (oldest first)
${thread}

TASK
${rules}`

  try {
    const { data } = await llmJson<{ drafts?: unknown }>({ system, user: userMsg, temperature: 0.9 })
    const raw = Array.isArray(data.drafts) ? data.drafts : []
    const drafts = raw.map(d => String(d).trim()).filter(Boolean).slice(0, 3)
    if (drafts.length === 0) return NextResponse.json({ error: 'The AI returned no usable draft. Try again.' }, { status: 502 })
    return NextResponse.json({ drafts })
  } catch (e) {
    const msg = e instanceof LlmError ? e.message : 'Could not reach the AI service. Try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
