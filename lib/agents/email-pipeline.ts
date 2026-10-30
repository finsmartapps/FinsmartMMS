// Orchestrates Strategist → Copywriter → Critic, retrying with the critic's notes.

import { plan, type Brief, type Variant } from './strategist'
import { writeEmail, assemble } from './copywriter'
import { critique, stripFrame, type QaResult } from './critic'
import type { AbmAccount, AbmContact, AbmAgentSettings, ResearchFact } from '@/lib/account-pursuit/types'

export interface PipelineInput {
  account: AbmAccount
  contact: AbmContact
  settings: AbmAgentSettings
  offer: { value_prop?: string | null; icp?: string | null; tone?: string | null } | null
  thread: string
  step: number
  instructions?: string
  // earlier drafts to this account / sent emails, for anti-template checks
  recentDrafts: { body: string; angle: string | null; variant: Partial<Variant> | null }[]
  corpusBodies: string[]
  research?: ResearchFact[]      // verified facts from the Researcher agent
}

export interface PipelineResult {
  subject: string
  body: string                 // full text: greeting + body + signature
  qa: QaResult
  brief: Brief
  provider: string
  model: string
  attempts: number
}

const MAX_ATTEMPTS = 3

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

// Everything the writer is allowed to mention. Numbers / names outside this text are flagged by the Critic.
function allowedFacts(inp: PipelineInput, brief: Brief): string {
  const a = inp.account, c = inp.contact
  const state = a.state ? `${a.state} ${STATES[a.state.trim().toUpperCase()] ?? ''}` : ''
  return [
    a.name, a.industry, a.targeted_industry, state, a.country, a.employee_size ? `${a.employee_size} people employees` : '',
    a.revenue_text, a.associations, a.software_partnerships, a.offshore_presence, a.compelling_event, a.pain_hypothesis,
    c.first_name, c.last_name, c.job_title,
    brief.fact?.text, brief.fact?.evidence,
    ...(inp.research ?? []).flatMap(f => [f.claim, f.evidence]),
    inp.settings.sender_company, inp.instructions, inp.thread,
  ].filter(Boolean).join(' . ')
}

export async function generateEmailDraft(inp: PipelineInput): Promise<PipelineResult> {
  const sender = inp.settings.sender_name

  const brief = plan({
    account: inp.account,
    contact: inp.contact,
    step: inp.step,
    usedFactKeys: inp.recentDrafts.map(d => d.angle).filter((x): x is string => !!x),
    recentVariants: inp.recentDrafts.map(d => d.variant ?? {}),
    research: inp.research,
  })
  const allowedText = allowedFacts(inp, brief)
  // numbers may only come from the fact being used or the account's own size / revenue figures
  const numbersText = [
    brief.fact?.text, brief.fact?.evidence,
    inp.account.employee_size, inp.account.revenue_text, inp.account.revenue_usd,
    inp.instructions, inp.thread,
  ].filter(Boolean).join(' . ')

  const corpus = inp.corpusBodies.map(b => stripFrame(b, sender)).filter(Boolean)

  let best: PipelineResult | null = null
  let notes: string[] | undefined

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const w = await writeEmail({
      brief, account: inp.account, contact: inp.contact, settings: inp.settings,
      offer: inp.offer, thread: inp.thread, instructions: inp.instructions, revisionNotes: notes,
    })

    const qa = critique({
      subject: w.subject, body: w.body, step: inp.step, accountName: inp.account.name,
      factText: brief.fact?.text ?? null, corpus, senderName: inp.settings.sender_name, allowedText, numbersText,
    })

    const result: PipelineResult = {
      subject: w.subject,
      body: assemble(w.body, inp.contact.first_name, brief, inp.settings),
      qa, brief, provider: w.provider, model: w.model, attempts: attempt,
    }
    if (!best || qa.score > best.qa.score) best = result
    if (qa.passed) return result
    notes = qa.issues
  }
  return best!
}
