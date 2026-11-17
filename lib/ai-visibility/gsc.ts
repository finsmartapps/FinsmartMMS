// Search Console via a Google service account (free). No googleapis dependency: we sign the JWT with node:crypto.
// Env: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY (the "private_key" from the JSON key, \n escapes are fine),
//      GSC_SITE (default sc-domain:finsmartaccounting.com). The service account email must be added as a
//      user (Restricted is enough) on the Search Console property.

import { createSign } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isQuestionLike, sameQuestion } from './detect'

export function gscConfigured(): boolean {
  return !!(process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY)
}

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function accessToken(): Promise<string> {
  const email = process.env.GSC_CLIENT_EMAIL!
  const key = process.env.GSC_PRIVATE_KEY!.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${b64url(signer.sign(key))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    signal: AbortSignal.timeout(15_000),
  })
  const d = await res.json() as { access_token?: string; error_description?: string; error?: string }
  if (!d.access_token) throw new Error(`Google auth failed: ${d.error_description || d.error || res.status}`)
  return d.access_token
}

type Row = { keys: string[]; clicks: number; impressions: number; position: number }

async function query(token: string, body: Record<string, unknown>): Promise<Row[]> {
  const site = process.env.GSC_SITE || 'sc-domain:finsmartaccounting.com'
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Search Console HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return ((await res.json()) as { rows?: Row[] }).rows ?? []
}

function day(offset: number): string {
  const d = new Date(Date.now() - offset * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export async function gscStep(db: SupabaseClient) {
  if (!gscConfigured()) return { skipped: 'Search Console key not set (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY).' }
  const token = await accessToken()
  // Search Console data lags ~3 days.
  const cur = { startDate: day(30), endDate: day(3) }
  const prev = { startDate: day(58), endDate: day(31) }
  const snapshot = day(0)

  const [pagesNow, pagesPrev, queries] = await Promise.all([
    query(token, { ...cur, dimensions: ['page'], rowLimit: 1000 }),
    query(token, { ...prev, dimensions: ['page'], rowLimit: 1000 }),
    query(token, { ...cur, dimensions: ['query', 'page'], rowLimit: 5000 }),
  ])

  const prevMap = new Map(pagesPrev.map(r => [r.keys[0], r]))
  const allPages = new Set([...pagesNow.map(r => r.keys[0]), ...pagesPrev.map(r => r.keys[0])])
  const nowMap = new Map(pagesNow.map(r => [r.keys[0], r]))
  const pageRows = [...allPages].map(page => {
    const n = nowMap.get(page), p = prevMap.get(page)
    return {
      snapshot_date: snapshot, page,
      clicks: n?.clicks ?? 0, impressions: n?.impressions ?? 0, position: n ? Math.round(n.position * 10) / 10 : null,
      prev_clicks: p?.clicks ?? 0, prev_impressions: p?.impressions ?? 0, prev_position: p ? Math.round(p.position * 10) / 10 : null,
    }
  })
  for (let i = 0; i < pageRows.length; i += 500) {
    await db.from('aiv_gsc_pages').upsert(pageRows.slice(i, i + 500), { onConflict: 'snapshot_date,page' })
  }

  // Question-like queries, rolled up across pages.
  const qMap = new Map<string, { clicks: number; impressions: number; posSum: number; top: string; topImp: number }>()
  for (const r of queries) {
    const [q, page] = r.keys
    if (!isQuestionLike(q)) continue
    const e = qMap.get(q) ?? { clicks: 0, impressions: 0, posSum: 0, top: page, topImp: 0 }
    e.clicks += r.clicks; e.impressions += r.impressions; e.posSum += r.position * r.impressions
    if (r.impressions > e.topImp) { e.top = page; e.topImp = r.impressions }
    qMap.set(q, e)
  }
  const qRows = [...qMap.entries()].map(([q, e]) => ({
    snapshot_date: snapshot, query: q, clicks: e.clicks, impressions: e.impressions,
    position: e.impressions ? Math.round((e.posSum / e.impressions) * 10) / 10 : null, top_page: e.top,
  }))
  for (let i = 0; i < qRows.length; i += 500) {
    await db.from('aiv_gsc_queries').upsert(qRows.slice(i, i + 500), { onConflict: 'snapshot_date,query' })
  }

  // Suggest the strongest new question-like queries (US-intent filter is left to the human reviewer).
  const [{ data: existingQ }, { data: existingS }] = await Promise.all([
    db.from('aiv_questions').select('question'),
    db.from('aiv_suggestions').select('question'),
  ])
  const known = [...(existingQ ?? []), ...(existingS ?? [])].map(r => r.question as string)
  const fresh = qRows
    .filter(r => r.impressions >= 10 && !known.some(k => sameQuestion(k, r.query)))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)
    .map(r => ({ question: r.query, source: 'gsc', reason: `${r.impressions} Google impressions in 28 days, avg position ${r.position ?? '-'}` }))
  if (fresh.length) await db.from('aiv_suggestions').upsert(fresh, { onConflict: 'question', ignoreDuplicates: true })

  return { pages: pageRows.length, question_queries: qRows.length, suggested: fresh.length }
}
