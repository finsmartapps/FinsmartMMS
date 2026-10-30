// Strategist agent — decides WHAT to say and HOW to shape it, before any writing happens.
// 1. Picks one real, verifiable fact about the account (never invents).
// 2. Picks a random structural "variant" so no two emails share a skeleton
//    (identical skeletons are what spam filters cluster as bulk mail).

import type { AbmAccount, AbmContact } from '@/lib/account-pursuit/types'

export interface Fact { key: string; label: string; text: string }

export interface Variant {
  opening: string
  structure: string
  targetWords: number
  cta: string
  subjectStyle: string
  greeting: string
}

export interface Brief {
  step: number
  stepGoal: string
  fact: Fact | null
  variant: Variant
  needsResearch: boolean
}

const clean = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim()

export function collectFacts(a: AbmAccount): Fact[] {
  const out: Fact[] = []
  const add = (key: string, label: string, raw: string | null | undefined, max = 280) => {
    const t = clean(raw)
    if (t.length > 2 && !/^(n\/?a|none|unknown|-+|null)$/i.test(t)) out.push({ key, label, text: t.slice(0, max) })
  }
  // ordered strongest → weakest
  add('compelling_event', 'a recent event / reason this is relevant now', a.compelling_event)
  add('pain', 'a problem we believe firms like theirs have', a.pain_hypothesis)
  add('associations', 'professional associations they belong to', a.associations)
  add('software', 'software / tech partners they work with', a.software_partnerships)
  add('offshore', 'their current offshore or outsourcing setup', a.offshore_presence)
  add('vertical', 'a vertical they focus on', a.targeted_industry)
  if (a.employee_size) add('size', 'rough firm size', `about ${a.employee_size} people`)
  if (a.state) add('location', 'where the firm is based', [a.state, a.country].filter(Boolean).join(', '))
  return out
}

function pickOne<T>(pool: T[], avoid: T[]): T {
  const fresh = pool.filter(p => !avoid.includes(p))
  const from = fresh.length ? fresh : pool
  return from[Math.floor(Math.random() * from.length)]
}

const OPENINGS = [
  'open with one specific observation about their firm',
  'open with a direct, genuine question about how they handle something in their world',
  'open by naming the specific trigger that made you think of them',
  'open plainly with why you are writing to them specifically, in one sentence',
]
const STRUCTURES = [
  'two short paragraphs',
  'three separate one-to-two sentence lines',
  'a single compact paragraph',
  'one short paragraph then a one-line question on its own',
]
const CTAS = [
  'end with a soft question about their view or experience',
  'end by offering to share a thought or two on it, only if they would find that useful',
  'end by asking if it is even on their radar right now',
  'end with a no-pressure line that leaves the door open, no question mark',
]
const SUBJECT_STYLES = [
  'two to four lowercase words about their firm or the trigger',
  'a short, honest question',
  'their firm name plus one topic word',
  'a plain statement, like a note between colleagues',
]
const GREETINGS = ['Hi {first},', 'Hi {first},', 'Hello {first},', '{first},']
const LENGTHS = [55, 75, 95]

export function stepGoal(step: number): string {
  if (step <= 1) return 'TOUCH 1 — start a genuine peer conversation. Be relevant and curious. Do NOT pitch or describe what the seller sells, and do NOT ask for a meeting or a call.'
  if (step === 2) return 'TOUCH 2 — add one genuinely useful observation or insight relevant to them. Refer to the first email only lightly (not "following up"). Still no hard pitch, no meeting grab.'
  return 'TOUCH 3 — a short, low-pressure close-the-loop note. Acknowledge they are busy, leave the door open, make it easy to ignore. No pressure.'
}

export function plan(input: {
  account: AbmAccount
  contact: AbmContact
  step: number
  usedFactKeys: string[]          // facts already used in recent drafts to this account
  recentVariants: Partial<Variant>[]
}): Brief {
  const facts = collectFacts(input.account)
  const top = facts.slice(0, 4)
  const fact = top.length
    ? (top.find(f => !input.usedFactKeys.includes(f.key)) ?? top[0])
    : null

  const rv = input.recentVariants
  const variant: Variant = {
    opening: pickOne(OPENINGS, rv.map(v => v.opening as string)),
    structure: pickOne(STRUCTURES, rv.map(v => v.structure as string)),
    targetWords: pickOne(LENGTHS, rv.map(v => v.targetWords as number)),
    cta: pickOne(CTAS, rv.map(v => v.cta as string)),
    subjectStyle: pickOne(SUBJECT_STYLES, rv.map(v => v.subjectStyle as string)),
    greeting: pickOne(GREETINGS, []),
  }

  return { step: input.step, stepGoal: stepGoal(input.step), fact, variant, needsResearch: !fact }
}
