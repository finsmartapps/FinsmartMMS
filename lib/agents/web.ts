// Free, dependency-free web helpers for the Researcher agent.
// Polite, small-volume fetching of a firm's own public pages + Google News RSS headlines.

const UA = 'Mozilla/5.0 (compatible; FinsmartResearchBot/1.0; +https://finsmartaccounting.com)'
const MAX_BYTES = 400_000

// Block anything that is not a normal public http(s) host (SSRF guard).
function isSafeUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || !h.includes('.')) return false
  return true
}

export function normalizeWebsite(raw: string | null | undefined): URL | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return isSafeUrl(u) ? u : null
  } catch { return null }
}

export async function fetchText(url: string, timeoutMs = 10_000): Promise<{ ok: boolean; finalUrl: string; body: string; contentType: string }> {
  let current = url
  for (let hop = 0; hop < 4; hop++) {
    let u: URL
    try { u = new URL(current) } catch { return { ok: false, finalUrl: current, body: '', contentType: '' } }
    if (!isSafeUrl(u)) return { ok: false, finalUrl: current, body: '', contentType: '' }
    try {
      const res = await fetch(u, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5' },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location')!, u).toString()
        continue
      }
      if (!res.ok) return { ok: false, finalUrl: current, body: '', contentType: '' }
      const contentType = res.headers.get('content-type') ?? ''
      if (!/text\/|xml|json/i.test(contentType)) return { ok: false, finalUrl: current, body: '', contentType }
      const body = (await res.text()).slice(0, MAX_BYTES)
      return { ok: true, finalUrl: current, body, contentType }
    } catch {
      return { ok: false, finalUrl: current, body: '', contentType: '' }
    }
  }
  return { ok: false, finalUrl: current, body: '', contentType: '' }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '-', mdash: '-', hellip: '...' }

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/[ \t\f\v ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function pageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim().slice(0, 140) : ''
}

// Same-site links worth reading, best first.
const LINK_SCORE: [RegExp, number][] = [
  [/\b(news|press|media|announce)/i, 5],
  [/\b(team|people|leadership|partners|professionals|our-firm|who-we-are|meet)/i, 5],
  [/\b(about|firm|company|story)/i, 4],
  [/\b(careers?|join|jobs|hiring|opportunit)/i, 3],
  [/\b(blog|insights?|articles?|resources)/i, 2],
  [/\b(services|solutions|industries)/i, 1],
]

export function pickLinks(html: string, base: URL, max = 4): string[] {
  const scored = new Map<string, number>()
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u: URL
    try { u = new URL(decodeEntities(m[1]), base) } catch { continue }
    if (!isSafeUrl(u)) continue
    if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue
    if (/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|mp4)$/i.test(u.pathname)) continue
    u.hash = ''
    const key = u.toString().replace(/\/$/, '')
    if (key === base.toString().replace(/\/$/, '')) continue
    const hay = `${u.pathname} ${htmlToText(m[2]).slice(0, 60)}`
    let score = 0
    for (const [re, pts] of LINK_SCORE) if (re.test(hay)) score = Math.max(score, pts)
    if (score > 0) scored.set(key, Math.max(scored.get(key) ?? 0, score) - (u.pathname.split('/').length > 4 ? 1 : 0))
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k)
}

export interface NewsItem { title: string; link: string; date: string | null; publisher: string }

function cdata(s: string): string {
  return decodeEntities(s.replace(/^<!\[CDATA\[|\]\]>$/g, '')).replace(/\s+/g, ' ').trim()
}

// Google News RSS: free, no key. Returns headlines only (we never need the article body).
export async function googleNews(query: string, maxAgeDays = 540, limit = 8): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const r = await fetchText(url, 8000)
  if (!r.ok) return []
  const cutoff = Date.now() - maxAgeDays * 86_400_000
  const out: NewsItem[] = []
  for (const block of r.body.split('<item>').slice(1)) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
      return m ? cdata(m[1]) : ''
    }
    const rawTitle = get('title')
    const publisher = get('source')
    const title = publisher && rawTitle.endsWith(` - ${publisher}`) ? rawTitle.slice(0, -(publisher.length + 3)) : rawTitle
    const t = Date.parse(get('pubDate'))
    if (!title || (Number.isFinite(t) && t < cutoff)) continue
    out.push({ title, link: get('link'), date: Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null, publisher })
    if (out.length >= limit) break
  }
  return out
}
