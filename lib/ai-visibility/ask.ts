// Weekly "ask the AI" run. Each cron call answers a few (question, engine) pairs and returns;
// the GitHub workflow keeps calling until the run is done. Free models only (lib/agents/llm.ts).

import type { SupabaseClient } from '@supabase/supabase-js'
import { llmJson, configuredEngines } from '@/lib/agents/llm'
import { detectMentions, extractUrls, type BrandLite, type NamedBrand } from './detect'

const RUN_EVERY_DAYS = 6
const TIME_BUDGET_MS = 40_000

const SYSTEM = `You are an AI assistant answering a question from a business owner in the United States.
Answer the way you normally would for a real user: helpful, specific, and honest. If companies or
providers are relevant, name the ones you would actually recommend, best first. Do not invent companies.
Reply as JSON only:
{"answer": "<your full answer, plain text>",
 "brands": [{"name": "<company or product you named, in the order you named them>", "website": "<domain if you know it, else empty>"}],
 "sources": ["<URLs you would cite, if any>"]}`

type Pair = { question_id: string; question: string; engine: string }

export async function currentRun(db: SupabaseClient, opts: { force?: boolean } = {}) {
  const { data: last } = await db.from('aiv_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (last && last.status === 'running') return last
  const ageDays = last ? (Date.now() - new Date(last.started_at).getTime()) / 86_400_000 : Infinity
  if (!opts.force && ageDays < RUN_EVERY_DAYS) return null
  const engines = configuredEngines()
  if (engines.length === 0) throw new Error('No free AI key set (GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY).')
  const { data: run, error } = await db.from('aiv_runs').insert({ engines }).select('*').single()
  if (error) throw new Error(error.message)
  return run
}

export async function askStep(db: SupabaseClient, opts: { force?: boolean } = {}) {
  const started = Date.now()
  const run = await currentRun(db, opts)
  if (!run) return { done: true, note: 'Last run is less than a week old.' }

  const [{ data: qs }, { data: brands }, { data: doneRows }] = await Promise.all([
    db.from('aiv_questions').select('id, question').eq('active', true),
    db.from('aiv_brands').select('id, name, domain, aliases, exclude').eq('active', true),
    db.from('aiv_answers').select('question_id, engine').eq('run_id', run.id),
  ])
  const done = new Set((doneRows ?? []).map(r => `${r.question_id}|${r.engine}`))
  const pending: Pair[] = []
  for (const q of qs ?? []) for (const e of run.engines as string[]) {
    if (!done.has(`${q.id}|${e}`)) pending.push({ question_id: q.id, question: q.question, engine: e })
  }

  let answered = 0
  for (const p of pending) {
    if (Date.now() - started > TIME_BUDGET_MS) break
    const row: Record<string, unknown> = { run_id: run.id, question_id: p.question_id, engine: p.engine }
    try {
      const { data, model } = await llmJson<{ answer?: string; brands?: NamedBrand[]; sources?: string[] }>({
        system: SYSTEM, user: p.question, temperature: 0.4, only: p.engine,
      })
      const answer = String(data.answer ?? '').slice(0, 8000)
      const named = (Array.isArray(data.brands) ? data.brands : [])
        .filter(b => b && typeof b.name === 'string')
        .map(b => ({ name: b.name.slice(0, 120), website: typeof b.website === 'string' ? b.website.slice(0, 120) : '' }))
        .slice(0, 25)
      Object.assign(row, {
        model, answer, brands_named: named,
        mentions: detectMentions(answer, named, (brands ?? []) as BrandLite[]),
        urls: extractUrls(answer, ...(Array.isArray(data.sources) ? data.sources.map(String) : [])),
      })
    } catch (e) {
      const msg = (e as Error).message
      // Free-tier rate limit: leave this pair pending and stop; the next call picks it up.
      if (/HTTP 429/.test(msg) && !/HTTP (?!429)\d{3}/.test(msg)) {
        return { done: false, run_id: run.id, answered, remaining: pending.length - answered, note: 'rate limited, will continue' }
      }
      Object.assign(row, { status: 'error', error: msg.slice(0, 500) })
    }
    await db.from('aiv_answers').upsert(row, { onConflict: 'run_id,question_id,engine' })
    answered++
  }

  const remaining = pending.length - answered
  if (remaining === 0) {
    await db.from('aiv_runs').update({ status: 'done', finished_at: new Date().toISOString() }).eq('id', run.id)
  }
  return { done: remaining === 0, run_id: run.id, answered, remaining }
}
