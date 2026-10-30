// Copywriter agent — turns the Strategist's brief into one plain-text cold email.
// The LLM writes ONLY subject + core body. Greeting and signature are assembled in code
// so the signature is always exactly the three lines Finsmart uses.

import { llmJson } from './llm'
import type { Brief } from './strategist'
import type { AbmAccount, AbmContact, AbmAgentSettings } from '@/lib/account-pursuit/types'

export interface WriteInput {
  brief: Brief
  account: AbmAccount
  contact: AbmContact
  settings: AbmAgentSettings
  offer: { value_prop?: string | null; icp?: string | null; tone?: string | null } | null
  thread: string                 // earlier conversation, oldest first
  instructions?: string
  revisionNotes?: string[]       // critic feedback from a failed attempt
}

const SYSTEM = (s: AbmAgentSettings) => `You are ${s.sender_name}, ${s.sender_title} at ${s.sender_company}. You have spent 40 years in B2B sales to accounting firms and you write the way a seasoned, respected peer writes: plainly, specifically, briefly. You are writing ONE email to ONE real person. It must not read like a campaign.

HOW YOU WRITE
- Plain text only. No bullets, no bold, no emojis, no links, no exclamation marks.
- Never use em dashes or en dashes. Use commas and full stops.
- Short, natural sentences with uneven rhythm. Contractions are fine. Sound like a person typing a note, not a brochure.
- Specific beats polite. One concrete observation is worth more than three compliments.
- Do not flatter. Do not say you were impressed. Do not say you came across them or are reaching out.
- Never use: "hope this finds you", "touch base", "circle back", "synergy", "leverage", "unlock", "streamline", "seamless", "robust", "tailored", "cutting-edge", "game-changer", "love to", "quick call", "15 minutes", "free", "opportunity", "partnership".
- Never invent facts. You may only use the FACT given below about their firm. That also means: never claim what other firms do, what other people "tell you", what you have "seen", or any past client results, and never imply you hold an example, case study or report. Do not claim you have seen their website, a post, or a press release unless the FACT says so.
- Do not describe or sell services on touch 1. The seller's offer is private background so you stay relevant, never to be listed.
- Do NOT write a greeting line (like "Hi Sam,") and do NOT write a sign-off or signature. Those are added separately.

OUTPUT: strict JSON only: {"subject":"...","body":"..."}`

export async function writeEmail(inp: WriteInput): Promise<{ subject: string; body: string; provider: string; model: string }> {
  const { brief, account, contact, settings } = inp
  const c = contact
  const name = `${c.first_name} ${c.last_name ?? ''}`.trim()

  const user = `WHO YOU ARE WRITING TO
${name}, ${c.job_title ?? 'role unknown'} (${c.committee_role.replace('_', ' ')}) at ${account.name}.
Firm: ${[account.industry, account.employee_size ? `about ${account.employee_size} people` : '', account.state].filter(Boolean).join(', ') || 'details unknown'}.

THE ONE FACT TO BUILD ON (${brief.fact ? brief.fact.label : 'none available'})
${brief.fact ? brief.fact.text : 'No account-specific fact is known. Write a short, honest, curious note based only on their role and firm name. Do not pretend to know more.'}

STAGE
${brief.stepGoal}

SHAPE OF THIS EMAIL (follow all of these exactly so it is different from every other email)
- ${brief.variant.opening}
- structure: ${brief.variant.structure}
- about ${brief.variant.targetWords} words (hard maximum 110)
- ${brief.variant.cta}
- subject: ${brief.variant.subjectStyle}, 8 words maximum, sentence case or lowercase (never Title Case)
- the BODY must use completely normal capitalisation and punctuation: capital letter at the start of every sentence and for names. Only the subject may be lowercase.

PRIVATE BACKGROUND ON THE SELLER (do not list or pitch this)
${inp.offer?.value_prop ?? 'n/a'}
Tone: ${inp.offer?.tone ?? 'warm, concise, peer-to-peer'}

EARLIER CONVERSATION
${inp.thread || '(none, this is the first email)'}
${inp.instructions ? `\nEXTRA INSTRUCTION FROM THE USER: ${inp.instructions.slice(0, 400)}` : ''}${inp.revisionNotes?.length ? `\n\nYOUR LAST ATTEMPT WAS REJECTED. Fix every one of these and write it differently:\n- ${inp.revisionNotes.join('\n- ')}` : ''}

Write the email now.`

  const { data, provider, model } = await llmJson<{ subject?: string; body?: string }>({
    system: SYSTEM(settings), user, temperature: 0.95,
  })
  return {
    subject: (data.subject ?? '').toString().trim().replace(/^["']|["']$/g, ''),
    body: (data.body ?? '').toString().trim(),
    provider, model,
  }
}

// Greeting + signature are code, not LLM — exact format, every time.
export function assemble(core: string, firstName: string, brief: Brief, s: AbmAgentSettings): string {
  const greeting = brief.variant.greeting.replace('{first}', firstName)
  const signature = [s.sender_name, s.sender_title, s.sender_company].join('\n')
  return `${greeting}\n\n${core.trim()}\n\n${signature}`
}
