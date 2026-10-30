// Critic agent — deterministic "does this read like a mass/AI-written email?" checks.
// Pure functions, no imports, so it is cheap, free and unit-testable.

export interface QaResult {
  score: number          // 0-100
  passed: boolean
  issues: string[]       // hard problems — trigger a rewrite
  warnings: string[]     // soft problems — shown to the human reviewer
}

// Phrases that mark text as templated / LLM-written / mass outreach.
const BANNED: { re: RegExp; why: string }[] = [
  { re: /\bi hope this (email|message|note) finds you\b/i, why: 'generic opener "hope this finds you"' },
  { re: /\bi (came|stumbled) across\b/i, why: '"I came across" is a mass-outreach tell' },
  { re: /\b(i wanted to|i am|i\'m) (reach|reaching) out\b|\breaching out\b/i, why: '"reaching out" is a mass-outreach tell' },
  { re: /\btouch(ing)? base\b|\bcircle back\b|\bjust checking in\b|\bfollowing up on my (last|previous)\b/i, why: 'stock follow-up phrasing' },
  { re: /\b(synerg|leverag|game[- ]chang|cutting[- ]edge|state[- ]of[- ]the[- ]art|world[- ]class|best[- ]in[- ]class|turnkey|end[- ]to[- ]end)\w*/i, why: 'buzzword' },
  { re: /\b(unlock|streamline|revolutioni[sz]e|elevate|empower|seamless(ly)?|robust|holistic|tailored solutions?|innovative)\b/i, why: 'AI-flavoured buzzword' },
  { re: /\bdelve\b|\btapestry\b|\blandscape\b|\bin today'?s (fast[- ]paced|ever[- ]evolving|digital)\b|\bever[- ]evolving\b/i, why: 'classic LLM phrasing' },
  { re: /\bi('d| would) love to\b|\bpick your brain\b|\bhop on a (quick )?call\b|\b(15|10|20|30)[- ]?(min|minute)s?\b/i, why: 'salesy ask / meeting-grab' },
  { re: /\bi noticed (that )?you\b|\bimpressed (by|with)\b|\bI('ve| have) been following\b/i, why: 'fake-flattery opener' },
  { re: /\b(free|guarantee|limited time|act now|exclusive offer|no obligation|risk[- ]free)\b/i, why: 'spam-trigger word' },
  { re: /\bas an ai\b|\bcertainly\b|\babsolutely\b|\bI trust this\b/i, why: 'assistant-style phrasing' },
]

// Claims about experience / other firms that the data can't back up. The writer is only
// allowed to use the one account fact it was given, so these are invented.
const UNVERIFIABLE = /\b(tell|told) me\b|\bi('ve| have) (seen|worked with|helped|talked to|spoken|heard|spent|been (doing|working))\b|\bdecades\b|\b\d+\+? years\b|\byears of experience\b|\bin my experience\b|\bwe('ve| have) (helped|worked|seen)\b|\b(our|my) (clients?|customers?)\b|\bother (\w+ ){0,2}(firms|practices|partners|cpas)\b|\bmost (\w+ ){0,3}(firms|partners|owners|directors|leaders)\b|\bfirms (like yours|i work with)\b/i

const SUBJECT_BAD = /\b(free|quick|opportunity|partnership|proposal|offer|exclusive|urgent|invitation|re:|fwd:)\b/i

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

export function wordCount(s: string): number {
  return (s.match(/\b[\w'’-]+\b/g) ?? []).length
}

function sentences(s: string): string[] {
  return s.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean)
}

function trigrams(s: string): Set<string> {
  const w = s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`)
  return out
}

export function similarity(a: string, b: string): number {
  const A = trigrams(a), B = trigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

// Remove greeting line + signature so we compare only the written part.
export function stripFrame(text: string, senderName: string): string {
  let t = text.trim()
  const sig = t.lastIndexOf(`\n\n${senderName}`)
  if (sig > 0) t = t.slice(0, sig)
  t = t.replace(/^(hi|hello|hey)?\s*[\w'’-]+,\s*\n+/i, '')
  return t.trim()
}

export interface CriticInput {
  subject: string
  body: string                 // core body: no greeting, no signature
  step: number
  accountName: string
  factText: string | null      // the account fact the email was meant to use
  corpus: string[]             // earlier drafts/messages (core text) for duplicate detection
  senderName?: string          // the body should not repeat it (the signature has it)
}

export function critique(inp: CriticInput): QaResult {
  const issues: string[] = []
  const warnings: string[] = []
  let score = 100
  const hard = (m: string, p = 18) => { issues.push(m); score -= p }
  const soft = (m: string, p = 6) => { warnings.push(m); score -= p }

  const { subject, body } = inp

  // ── formatting that reads as marketing mail ──
  if (/[—–]/.test(body + subject)) hard('contains em/en dashes (strong AI tell) — use commas or periods')
  if (/!/.test(body + subject)) hard('contains exclamation marks')
  if (EMOJI.test(body + subject)) hard('contains emoji')
  if (/(^|\n)\s*([-*•]|\d+[.)])\s/.test(body)) hard('contains bullets or numbered lists')
  if (/\*\*|__|`|^#{1,6}\s/m.test(body)) hard('contains markdown formatting')
  if (/https?:\/\/|www\./i.test(body)) hard('contains a link (links hurt cold-email deliverability)')

  // ── banned phrases ──
  for (const b of BANNED) {
    const m = body.match(b.re)
    if (m) hard(`"${m[0]}" — ${b.why}`, 14)
  }

  // body must use normal sentence capitalisation (a lowercase style is only for the subject)
  const sents = sentences(body)
  const lower = sents.filter(s => /^[a-z]/.test(s)).length
  if (sents.length > 0 && lower / sents.length >= 0.34) hard('body sentences are not capitalised normally')

  const claim = body.match(UNVERIFIABLE)
  if (claim) hard(`"${claim[0]}" — invented claim about other firms or your experience; only state the given fact`, 16)

  // ── subject ──
  const sw = wordCount(subject)
  if (!subject.trim()) hard('missing subject', 25)
  else {
    if (sw > 8) hard('subject too long (max 8 words)')
    if (SUBJECT_BAD.test(subject)) hard('subject has a spam/marketing trigger word')
    if (subject === subject.toUpperCase() && /[A-Z]{4,}/.test(subject)) hard('subject is ALL CAPS')
  }

  // ── length ──
  const wc = wordCount(body)
  if (wc < 35) hard(`too short (${wc} words)`)
  if (wc > 130) hard(`too long (${wc} words) — cold emails should be under ~110`)
  else if (wc > 110) soft(`a bit long (${wc} words)`, 4)

  // ── rhythm: LLM text has uniform sentence length ──
  const lens = sentences(body).map(wordCount)
  if (lens.length >= 3) {
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length)
    if (sd < 3) soft('sentence lengths too uniform (reads machine-written)')
  }

  // ── pitch discipline on the first touch ──
  if (inp.step === 1 && !/\b(finsmart|offshore|outsourc\w*|accounting (talent|staff|team|support)|managed staffing)\b/i.test(body)) {
    soft('never says who you are or what Finsmart does, so the reader will not know why you wrote', 10)
  }
  const senderFirst = (inp.senderName ?? '').split(/\s+/)[0]
  if (senderFirst && new RegExp(`\\b${senderFirst}\\b`, 'i').test(body)) soft('repeats your own name in the body, the signature already has it', 6)
  const qs = (body.match(/\?/g) ?? []).length
  if (inp.step <= 2 && qs === 0) hard('no question, end with one specific easy-to-answer question', 16)
  if (qs > (inp.step === 1 ? 1 : 2)) hard('asks more than one question, keep touch 1 to a single specific question', 12)
  if (/\b(thought or two|open to (hearing|swapping|exchanging|a chat|connecting)|if you would find that useful|worth a (chat|conversation))\b/i.test(body)) hard('vague ask, replace with one specific question', 14)
  if (/\b(one|two|three|four|five|six|seven|eight|nine)\s+(hundred|thousand)\b|\bone hundred\b/i.test(body)) soft('numbers should be digits (e.g. 140)', 4)

  // ── personalisation ──
  const firm = inp.accountName.toLowerCase().replace(/\b(llc|llp|cpas?|inc|pc|p\.c\.|co|company|group|&|and)\b/g, ' ').replace(/[^a-z0-9\s]/g, ' ').trim()
  const firmTokens = firm.split(/\s+/).filter(t => t.length > 3)
  const lowerBody = body.toLowerCase()
  const mentionsFirm = firmTokens.length === 0 || firmTokens.some(t => lowerBody.includes(t))
  if (!mentionsFirm) soft('does not mention the firm by name', 8)

  if (inp.factText) {
    const keys = inp.factText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 4)
    const hits = keys.filter(k => lowerBody.includes(k)).length
    if (keys.length > 0 && hits === 0) hard('does not actually use the account-specific fact it was given', 20)
  } else {
    soft('no account-specific fact available — add a compelling event / pain to the account for a sharper email', 10)
  }

  // ── duplicate / template detection against earlier drafts ──
  let maxSim = 0
  let sameOpening = false
  const myFirst = (sentences(body)[0] ?? '').toLowerCase().split(/\s+/).slice(0, 5).join(' ')
  for (const prev of inp.corpus) {
    maxSim = Math.max(maxSim, similarity(body, prev))
    const pf = (sentences(prev)[0] ?? '').toLowerCase().split(/\s+/).slice(0, 5).join(' ')
    if (myFirst && pf && myFirst === pf) sameOpening = true
  }
  if (maxSim > 0.3) hard(`too similar to an earlier email (${Math.round(maxSim * 100)}% overlap) — reads as a template`, 25)
  else if (maxSim > 0.18) soft(`overlaps ${Math.round(maxSim * 100)}% with an earlier email`, 6)
  if (sameOpening) hard('starts the same way as an earlier email', 15)

  score = Math.max(0, Math.min(100, score))
  return { score, passed: issues.length === 0 && score >= 75, issues, warnings }
}
