// Classifier agent — decides what a reply means. Cheap deterministic rules first (bounces, auto-replies,
// unsubscribe requests), the free LLM only for real human replies. It only labels; it never invents facts.

import { llmJson } from './llm'

export type ReplyClass =
  | 'interested' | 'question' | 'not_now' | 'not_interested' | 'referral'
  | 'unsubscribe' | 'out_of_office' | 'bounce' | 'other'

export interface Classified {
  class: ReplyClass
  summary: string
  by: 'rule' | 'ai'
}

export interface RawReply {
  from: string
  subject: string
  text: string                     // reply text with quoted history already removed
  headers: Map<string, unknown>    // lower-case header name -> value (from mailparser)
  isDsn: boolean                   // delivery-status notification (bounce)
}

const AUTO_SUBJECT = /^\s*(automatic reply|auto[- ]?reply|autoreply|out of office|out-of-office|ooo\b|i am (currently )?(out|away)|vacation reply)/i
const UNSUB = /\b(unsubscribe|remove me|take me off|stop (emailing|contacting|sending)|do not (email|contact)|don'?t (email|contact) me|opt[- ]?out)\b/i

export function classifyByRules(r: RawReply): Classified | null {
  if (r.isDsn || /^(mailer-daemon|postmaster)@/i.test(r.from) || /^(undeliverable|delivery status notification|mail delivery (failed|subsystem)|returned mail|failure notice)/i.test(r.subject)) {
    return { class: 'bounce', summary: 'Email could not be delivered (address may be wrong).', by: 'rule' }
  }
  const auto = String(r.headers.get('auto-submitted') ?? '').toLowerCase()
  const precedence = String(r.headers.get('precedence') ?? '').toLowerCase()
  if ((auto && auto !== 'no') || r.headers.has('x-autoreply') || r.headers.has('x-autorespond') || /auto_reply|auto-reply/.test(precedence) || AUTO_SUBJECT.test(r.subject)) {
    return { class: 'out_of_office', summary: 'Automatic reply (out of office).', by: 'rule' }
  }
  if (UNSUB.test(r.text.slice(0, 400))) {
    return { class: 'unsubscribe', summary: 'Asked not to be contacted again.', by: 'rule' }
  }
  return null
}

export async function classifyReply(r: RawReply, ourEmail: string): Promise<Classified> {
  const ruled = classifyByRules(r)
  if (ruled) return ruled

  const system = `You classify replies to a cold sales email sent by a seller at an accounting-services company.
Return strict JSON only: {"class":"...","summary":"..."}
Allowed classes:
- interested: wants to talk, asks for more information, asks for a call/meeting/pricing, or says it is a good idea
- question: asks a clarifying question about who we are or what we do, without clear interest yet
- not_now: busy / wrong timing / revisit later / maybe in the future
- not_interested: clearly declines, says no need, already covered, or asks us to stop
- referral: points us to a different person or says someone else handles it
- other: anything else (unclear, personal note, thanks only)
"summary" is ONE plain sentence (max 22 words) of what the person actually said. Never add facts that are not in the reply.`
  const user = `Seller's email address: ${ourEmail}
Reply subject: ${r.subject}
Reply text:
"""
${r.text.slice(0, 1500)}
"""`
  try {
    const { data } = await llmJson<{ class?: string; summary?: string }>({ system, user, temperature: 0 })
    const ok: ReplyClass[] = ['interested', 'question', 'not_now', 'not_interested', 'referral', 'other']
    const cls = (ok as string[]).includes(data.class ?? '') ? (data.class as ReplyClass) : 'other'
    return { class: cls, summary: String(data.summary ?? '').slice(0, 220) || 'Reply received.', by: 'ai' }
  } catch {
    // AI unavailable: never lose the reply, just flag it for a human
    return { class: 'other', summary: 'Reply received (could not be auto-classified, please read it).', by: 'rule' }
  }
}
