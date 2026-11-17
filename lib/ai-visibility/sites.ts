// Free website checks: competitor sitemap watch (new / changed / removed pages) and AI readiness.

import type { SupabaseClient } from '@supabase/supabase-js'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const MAX_SITEMAPS = 40
const MAX_URLS = 8000

export const AI_BOTS: { name: string; ua: string }[] = [
  { name: 'GPTBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)' },
  { name: 'OAI-SearchBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)' },
  { name: 'ChatGPT-User', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)' },
  { name: 'ClaudeBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
  { name: 'PerplexityBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' },
  { name: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: 'Bingbot', ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
]
const ROBOTS_TOKENS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']

async function get(url: string, ua = BROWSER_UA, timeoutMs = 12_000): Promise<{ status: number; body: string; finalUrl: string }> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': ua, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
    const body = res.ok ? (await res.text()).slice(0, 3_000_000) : ''
    return { status: res.status, body, finalUrl: res.url || url }
  } catch {
    return { status: 0, body: '', finalUrl: url }
  }
}

// ── Sitemaps ────────────────────────────────────────────────────────────────

export function parseSitemap(xml: string): { sitemaps: string[]; urls: { loc: string; lastmod: string | null }[] } {
  const sitemaps: string[] = []
  const urls: { loc: string; lastmod: string | null }[] = []
  for (const m of xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)) {
    const loc = /<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)/i.exec(m[1])?.[1]?.trim()
    if (loc) sitemaps.push(loc.replace(/&amp;/g, '&'))
  }
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const loc = /<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)/i.exec(m[1])?.[1]?.trim()
    const lastmod = /<lastmod>\s*([^<]+)/i.exec(m[1])?.[1]?.trim() ?? null
    if (loc) urls.push({ loc: loc.replace(/&amp;/g, '&'), lastmod })
  }
  return { sitemaps, urls }
}

async function readSitemaps(domain: string): Promise<{ urls: Map<string, string | null>; read: number; note: string }> {
  const base = `https://${domain}`
  const robots = await get(`${base}/robots.txt`)
  const queue = [...robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1])
  if (queue.length === 0) queue.push(`${base}/sitemap_index.xml`, `${base}/sitemap.xml`, `${base}/wp-sitemap.xml`)
  const seen = new Set<string>()
  const urls = new Map<string, string | null>()
  let read = 0
  while (queue.length && read < MAX_SITEMAPS && urls.size < MAX_URLS) {
    const sm = queue.shift()!
    if (seen.has(sm)) continue
    seen.add(sm)
    const r = await get(sm)
    if (r.status !== 200 || !/<(urlset|sitemapindex)/i.test(r.body)) continue
    read++
    const p = parseSitemap(r.body)
    queue.push(...p.sitemaps.filter(s => !/image|video/i.test(s)))
    for (const u of p.urls) if (urls.size < MAX_URLS) urls.set(u.loc, u.lastmod)
  }
  return { urls, read, note: read === 0 ? 'No readable sitemap (blocked or missing).' : '' }
}

export async function sitemapStep(db: SupabaseClient, brand: { id: string; domain: string; sitemap_baselined: boolean }) {
  const { urls, read, note } = await readSitemaps(brand.domain)
  if (read === 0) return { brand: brand.domain, read, note }

  const now = new Date().toISOString()
  const existing = new Map<string, { lastmod: string | null; removed_at: string | null }>()
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('aiv_pages').select('url, lastmod, removed_at').eq('brand_id', brand.id).range(from, from + 999)
    for (const r of data ?? []) existing.set(r.url, { lastmod: r.lastmod, removed_at: r.removed_at })
    if (!data || data.length < 1000) break
  }

  const rows: Record<string, unknown>[] = []
  let added = 0, changed = 0
  for (const [url, lastmod] of urls) {
    const old = existing.get(url)
    if (!old) {
      added++
      rows.push({ brand_id: brand.id, url, lastmod, first_seen: now, last_seen: now, baseline: !brand.sitemap_baselined })
    } else {
      const isChanged = !!lastmod && !!old.lastmod && lastmod !== old.lastmod
      if (isChanged) changed++
      rows.push({ brand_id: brand.id, url, lastmod, last_seen: now, removed_at: null, ...(isChanged ? { changed_at: now } : {}) })
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db.from('aiv_pages').upsert(rows.slice(i, i + 500), { onConflict: 'brand_id,url' })
  }
  const gone = [...existing.entries()].filter(([u, v]) => !urls.has(u) && !v.removed_at).map(([u]) => u)
  for (let i = 0; i < gone.length; i += 200) {
    await db.from('aiv_pages').update({ removed_at: now }).eq('brand_id', brand.id).in('url', gone.slice(i, i + 200))
  }
  await db.from('aiv_brands').update({ sites_checked_at: now, sitemap_baselined: true }).eq('id', brand.id)
  return { brand: brand.domain, read, urls: urls.size, added: brand.sitemap_baselined ? added : 0, baseline: !brand.sitemap_baselined, changed, removed: gone.length }
}

// ── AI readiness ────────────────────────────────────────────────────────────

type Check = { key: string; label: string; ok: boolean; detail: string }

function robotsBlocks(robots: string, token: string): boolean {
  // Group lines by user-agent; a bot is blocked if its own group (or * when it has none) disallows "/".
  const groups: { agents: string[]; disallowAll: boolean }[] = []
  let cur: { agents: string[]; disallowAll: boolean } | null = null
  let lastWasAgent = false
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line)
    if (!m) continue
    const k = m[1].toLowerCase(), v = m[2].trim()
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], disallowAll: false }; groups.push(cur) }
      cur.agents.push(v.toLowerCase()); lastWasAgent = true
    } else {
      lastWasAgent = false
      if (cur && k === 'disallow' && v === '/') cur.disallowAll = true
    }
  }
  const own = groups.filter(g => g.agents.includes(token.toLowerCase()))
  const use = own.length ? own : groups.filter(g => g.agents.includes('*'))
  return use.some(g => g.disallowAll)
}

function pageChecks(html: string): { jsonLd: number; title: boolean; desc: boolean; h1: number; canonical: boolean; faq: boolean } {
  return {
    jsonLd: (html.match(/<script[^>]+application\/ld\+json/gi) ?? []).length,
    title: /<title>[^<]{5,}<\/title>/i.test(html),
    desc: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{30,}/i.test(html),
    h1: (html.match(/<h1[\s>]/gi) ?? []).length,
    canonical: /<link[^>]+rel=["']canonical["']/i.test(html),
    faq: /"@type"\s*:\s*"FAQPage"/i.test(html),
  }
}

export async function readinessStep(db: SupabaseClient, brand: { id: string; domain: string; is_us: boolean }, keyPages: string[]) {
  const base = `https://${brand.domain}`
  const checks: Check[] = []

  const robots = await get(`${base}/robots.txt`)
  checks.push({ key: 'robots', label: 'robots.txt reachable', ok: robots.status === 200, detail: `HTTP ${robots.status}` })
  const blocked = robots.status === 200 ? ROBOTS_TOKENS.filter(t => robotsBlocks(robots.body, t)) : []
  checks.push({ key: 'robots_ai', label: 'robots.txt allows AI crawlers', ok: blocked.length === 0, detail: blocked.length ? `Blocked: ${blocked.join(', ')}` : 'No AI crawler blocked' })

  const botResults = await Promise.all(AI_BOTS.map(async b => ({ b, r: await get(`${base}/`, b.ua) })))
  const botFail = botResults.filter(x => x.r.status !== 200)
  checks.push({ key: 'bots_fetch', label: 'AI crawlers can load the home page', ok: botFail.length === 0, detail: botFail.length ? botFail.map(x => `${x.b.name} ${x.r.status || 'timeout'}`).join(', ') : `All ${AI_BOTS.length} got 200` })

  const llms = await get(`${base}/llms.txt`)
  checks.push({ key: 'llms', label: 'llms.txt present', ok: llms.status === 200 && llms.body.trim().length > 100 && !/<html/i.test(llms.body), detail: llms.status === 200 ? `${llms.body.length} characters` : `HTTP ${llms.status}` })

  const pages = brand.is_us && keyPages.length ? keyPages : ['/']
  for (const path of pages) {
    const r = await get(`${base}${path}`)
    const p = pageChecks(r.body)
    const problems: string[] = []
    if (r.status !== 200) problems.push(`HTTP ${r.status}`)
    else {
      if (!p.title) problems.push('no title')
      if (!p.desc) problems.push('no meta description')
      if (p.h1 !== 1) problems.push(`${p.h1} H1 tags`)
      if (!p.canonical) problems.push('no canonical')
      if (p.jsonLd === 0) problems.push('no schema (JSON-LD)')
    }
    checks.push({ key: `page:${path}`, label: `Page ${path}`, ok: problems.length === 0, detail: problems.length ? problems.join(', ') : `OK · ${p.jsonLd} schema block(s)${p.faq ? ' · FAQ schema' : ''}` })
  }

  const passed = checks.filter(c => c.ok).length
  await db.from('aiv_readiness').insert({ brand_id: brand.id, passed, total: checks.length, results: checks })
  return { brand: brand.domain, passed, total: checks.length }
}
