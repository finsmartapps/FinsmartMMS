// Orchestrates Strategist → Copywriter → Critic, retrying with the critic's notes.

import { plan, type Brief, type Variant } from './strategist'
import { writeEmail, assemble } from './copywriter'
import { critique, stripFrame, type QaResult } from './critic'
import type { AbmAccount, AbmContact, AbmAgentSettings } from '@/lib/account-pursuit/types'

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

export async function generateEmailDraft(inp: PipelineInput): Promise<PipelineResult> {
  const sender = inp.settings.sender_name

  const brief = plan({
    account: inp.account,
    contact: inp.contact,
    step: inp.step,
    usedFactKeys: inp.recentDrafts.map(d => d.angle).filter((x): x is string => !!x),
    recentVariants: inp.recentDrafts.map(d => d.variant ?? {}),
  })

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
      factText: brief.fact?.text ?? null, corpus,
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
