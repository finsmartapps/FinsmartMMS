// Weekly AI-suggested questions: new buyer questions we are not tracking yet, informed by
// competitor new pages and our Search Console queries. Suggestions wait for a human to Add or Dismiss.

import type { SupabaseClient } from '@supabase/supabase-js'
import { llmJson } from '@/lib/agents/llm'
import { sameQuestion } from './detect'

function slugTitle(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return (parts.pop() ?? '').replace(/[-_]+/g, ' ').replace(/\.\w+$/, '')
  } catch { return '' }
}

export async function suggestStep(db: SupabaseClient) {
  const weekAgo = new Date(Date.now() - 8 * 86_400_000).toISOString()
  const [{ data: qs }, { data: sugg }, { data: newPages }, { data: gscQ }] = await Promise.all([
    db.from('aiv_questions').select('question'),
    db.from('aiv_suggestions').select('question'),
    db.from('aiv_pages').select('url, brand:aiv_brands(name, is_us)').eq('baseline', false).gte('first_seen', weekAgo).limit(60),
    db.from('aiv_gsc_queries').select('query, impressions').order('snapshot_date', { ascending: false }).order('impressions', { ascending: false }).limit(30),
  ])
  const tracked = (qs ?? []).map(r => r.question as string)
  const known = [...tracked, ...(sugg ?? []).map(r => r.question as string)]

  const competitorTopics = (newPages ?? [])
    .filter(p => !(p.brand as unknown as { is_us: boolean } | null)?.is_us)
    .map(p => `${(p.brand as unknown as { name: string } | null)?.name ?? ''}: ${slugTitle(p.url as string)}`)
    .filter(s => s.length > 5)

  const user = `We are Finsmart Accounting: dedicated offshore accounting staff (bookkeeping, senior accounting, tax, review seats)
for US CPA firms and US small businesses, with published monthly pricing.

Questions we already track:
${tracked.map(q => `- ${q}`).join('\n')}

Competitors published these new pages this week:
${competitorTopics.slice(0, 40).map(t => `- ${t}`).join('\n') || '- (none)'}

People found our site on Google with these questions:
${(gscQ ?? []).map(r => `- ${r.query}`).join('\n') || '- (no data yet)'}

Suggest 6 NEW questions a US CPA firm owner, partner or small-business owner would type into ChatGPT or Google
when looking for a provider like us. Rules: buyer intent (choosing, comparing, pricing, risk, how-to-outsource),
US audience, plain wording, not already in the tracked list, no brand names except Finsmart in at most one question.
Reply as JSON: {"questions": [{"question": "...", "reason": "<one short sentence why it matters>"}]}`

  const { data } = await llmJson<{ questions?: { question?: string; reason?: string }[] }>({
    system: 'You are a B2B search strategist. Reply with JSON only.', user, temperature: 0.7,
  })
  const fresh = (data.questions ?? [])
    .map(q => ({ question: String(q.question ?? '').trim().slice(0, 300), reason: String(q.reason ?? '').slice(0, 300) }))
    .filter(q => q.question.length > 15 && !known.some(k => sameQuestion(k, q.question)))
    .map(q => ({ ...q, source: 'ai' }))
  if (fresh.length) await db.from('aiv_suggestions').upsert(fresh, { onConflict: 'question', ignoreDuplicates: true })
  return { suggested: fresh.length }
}
