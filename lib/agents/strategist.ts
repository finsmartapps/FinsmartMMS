// Strategist agent — decides WHAT to say and HOW to shape it, before any writing happens.
// 1. Picks one real, verifiable fact about the account (never invents).
// 2. Picks a random structural "variant" so no two emails share a skeleton
//    (identical skeletons are what spam filters cluster as bulk mail).

import type { AbmAccount, AbmContact, ResearchFact } from '@/lib/account-pursuit/types'

export interface Fact {
  key: string
  label: string
  text: string
  evidence?: string       // verbatim quote from a real source (research facts only)
  source_url?: string
  verified?: boolean
}

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
  roleContext: string
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
// Every ending is ONE specific question answerable in a line. Vague "open to a thought?" asks get ignored.
const CTAS = [
  'end with one specific either-or question about how they cover peak workload today (the existing team, temporary help, or a mix)',
  'end with one specific yes/no question about whether this particular pressure is real for them right now',
  'end by asking what they do when the workload outgrows the team',
  'end with one short, concrete question about their current setup for this exact task',
]
const SUBJECT_STYLES = [
  'two to four lowercase words about their firm or the trigger',
  'a short, honest question',
  'their firm name plus one topic word',
  'a plain statement, like a note between colleagues',
]
const GREETINGS = ['Hi {first},', 'Hi {first},', 'Hello {first},', '{first},']
const LENGTHS = [55, 75, 95]

// General, role-based context (true of the role, NOT a claim about this firm).
export function roleContext(title: string | null | undefined): string {
  const t = (title ?? '').toLowerCase()
  if (/controller|accounting manager|financial reporting|bookkeep/.test(t)) return 'Controllers usually own the month-end close, reconciliations, audit prep and staffing the accounting team.'
  if (/cfo|chief financial|finance director|vp finance|treasurer/.test(t)) return 'Finance leaders are usually judged on close speed, cost per transaction and team capacity without adding headcount.'
  if (/coo|operations|ops\b/.test(t)) return 'Operations leaders usually own throughput, the hiring pipeline and how fully the team is used.'
  if (/partner|owner|principal|president|ceo|founder|managing|shareholder/.test(t)) return 'Firm leaders usually care about busy-season capacity, keeping staff, and protecting margin as the firm grows.'
  if (/hr|talent|recruit|people/.test(t)) return 'People leaders usually deal with hiring pace, retention and cost of local hires.'
  return 'People in this kind of role usually feel the pressure of staffing and capacity during busy periods.'
}

export function stepGoal(step: number): string {
  if (step <= 1) return 'TOUCH 1 — a clear, specific cold email with exactly three parts: (1) one sentence tying to the FACT or their role, (2) one plain sentence saying who you are and what Finsmart does (touch 1 only), (3) ONE specific question they can answer in a single line. Do NOT ask for a call, meeting or calendar time.'
  if (step === 2) return 'TOUCH 2 — they did not reply to the first email. Add one genuinely useful observation relevant to them, using a DIFFERENT angle from the first email. Do NOT repeat the sentence about what Finsmart does (they already read it) and do not say "following up" or "checking in". Keep it shorter than the first email. End with one easy question. No pitch, no meeting grab.'
  return 'TOUCH 3 — a short, low-pressure close-the-loop note. Acknowledge they are busy, leave the door open, make it easy to ignore. No pressure.'
}

const RESEARCH_PRIORITY: Record<string, number> = { trigger: 0, people: 1, hiring: 2, growth: 3, award: 4, service: 5, tech: 6, other: 7 }
const RESEARCH_LABEL: Record<string, string> = {
  trigger: 'a recent event at the firm', people: 'something about this specific person (professional)', hiring: 'a hiring signal',
  growth: 'growth of the firm', award: 'a recognition the firm received', service: 'what the firm specialises in',
  tech: 'software the firm uses', other: 'a fact about the firm',
}

// Verified research first (best = recent trigger events), then the imported account columns.
export function researchToFacts(research: ResearchFact[]): Fact[] {
  return [...research]
    .sort((a, b) => (RESEARCH_PRIORITY[a.type] ?? 9) - (RESEARCH_PRIORITY[b.type] ?? 9) || (b.date ?? '').localeCompare(a.date ?? ''))
    .map(f => ({
      key: `r:${f.claim.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 40)}`,
      label: f.subject === 'contact' ? RESEARCH_LABEL.people : (RESEARCH_LABEL[f.type] ?? RESEARCH_LABEL.other),
      text: f.claim, evidence: f.evidence, source_url: f.source_url, verified: true,
    }))
}

export function plan(input: {
  account: AbmAccount
  contact: AbmContact
  step: number
  usedFactKeys: string[]          // facts already used in recent drafts to this account
  recentVariants: Partial<Variant>[]
  research?: ResearchFact[]
}): Brief {
  const facts = [...researchToFacts(input.research ?? []), ...collectFacts(input.account)]
  const top = facts.slice(0, 5)
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

  return { step: input.step, stepGoal: stepGoal(input.step), roleContext: roleContext(input.contact.job_title), fact, variant, needsResearch: !fact }
}
