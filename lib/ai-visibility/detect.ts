// Pure helpers: find which tracked brands an AI answer names, and where. No I/O, unit-testable.

export type BrandLite = {
  id: string
  name: string
  domain: string
  aliases: string[]
  exclude: string[]
}

export type NamedBrand = { name: string; website?: string }

function norm(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ')
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Remove look-alike names (e.g. "FinSmart Financial Solutions") before matching our own aliases.
function stripExcluded(text: string, exclude: string[]): string {
  let t = text
  for (const ex of exclude) {
    if (!ex.trim()) continue
    t = t.replace(new RegExp(escapeRe(norm(ex)), 'g'), ' ')
  }
  return t
}

function terms(b: BrandLite): string[] {
  const host = b.domain.toLowerCase().replace(/^www\./, '')
  return [...new Set([...b.aliases.map(norm), host].filter(Boolean))]
}

function hits(text: string, b: BrandLite): boolean {
  const t = stripExcluded(norm(text), b.exclude)
  return terms(b).some(a => new RegExp(`(^|[^a-z0-9])${escapeRe(a)}([^a-z0-9]|$)`).test(t))
}

// Returns {brandId: position}. Position = 1-based rank in the model's own brand list,
// or 0 when the brand only appears in the answer text.
export function detectMentions(answer: string, named: NamedBrand[], brands: BrandLite[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of brands) {
    const idx = named.findIndex(n => hits(`${n.name} ${n.website ?? ''}`, b))
    if (idx >= 0) out[b.id] = idx + 1
    else if (hits(answer, b)) out[b.id] = 0
  }
  return out
}

export function extractUrls(...texts: string[]): string[] {
  const set = new Set<string>()
  for (const t of texts) {
    for (const m of t.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)) set.add(m[0].replace(/[.,;:]+$/, ''))
  }
  return [...set].slice(0, 30)
}

// Question-like Search Console query (worth asking an AI).
const Q_START = /^(who|what|which|how|why|when|where|is|are|can|does|do|should|best|top|cost|price|pricing|compare)\b/i
export function isQuestionLike(q: string): boolean {
  const s = q.trim()
  return s.split(/\s+/).length >= 4 && (Q_START.test(s) || /\b(vs|versus|alternative|alternatives|near me|cost of|price of)\b/i.test(s))
}

export function sameQuestion(a: string, b: string): boolean {
  const k = (s: string) => norm(s).replace(/[^a-z0-9 ]/g, '').replace(/\b(the|a|an|for|of|in|to|and|is|are|what|which|who)\b/g, '').replace(/\s+/g, ' ').trim()
  return k(a) === k(b)
}
