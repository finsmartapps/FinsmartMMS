import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// AI "draft next message" — reads the account/contact/thread + offer context
// (RLS-scoped to the signed-in user) and asks Claude for follow-up options.

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
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI drafting is not configured yet. Add ANTHROPIC_API_KEY in your environment.' }, { status: 503 })
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

  const system = `You are an elite B2B account-based-marketing SDR writing LinkedIn/email outreach on behalf of the seller described below. You write concise, human, peer-to-peer messages that earn a reply. You never sound like a mass template, never open with a hard pitch, and always give the recipient a clear, low-friction reason to respond. Match the seller's tone.

SELLER OFFER
Value proposition: ${offer?.value_prop ?? 'N/A'}
Ideal customer: ${offer?.icp ?? 'N/A'}
Tone to use: ${offer?.tone ?? 'warm, concise, value-first'}`

  const rules = [
    `Channel: ${CHANNEL_LABEL[channel] ?? channel}.`,
    limit ? `HARD LIMIT: each draft must be at most ${limit} characters.` : `Keep it tight — a few short sentences, not a wall of text.`,
    contact.has_mutuals ? 'They share mutual connections — a warm-path reference is appropriate.' : 'No mutual connections — do not fabricate one.',
    intent !== 'auto' ? `Message intent: ${intent}.` : 'Infer the right next message from where the conversation stands.',
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json({ error: `AI request failed (${res.status}).`, detail: detail.slice(0, 300) }, { status: 502 })
    }

    const data = await res.json()
    const text: string = (data.content ?? []).map((b: { type: string; text?: string }) => b.text ?? '').join('').trim()

    // Extract the JSON object even if wrapped in prose/code fences.
    let drafts: string[] = []
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { drafts = JSON.parse(match[0]).drafts ?? [] } catch { /* fall through */ }
    }
    if (!Array.isArray(drafts) || drafts.length === 0) drafts = text ? [text] : []
    drafts = drafts.map(d => String(d).trim()).filter(Boolean).slice(0, 3)

    return NextResponse.json({ drafts })
  } catch {
    return NextResponse.json({ error: 'Could not reach the AI service. Try again.' }, { status: 502 })
  }
}
