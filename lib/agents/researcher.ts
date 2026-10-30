// Researcher agent — finds real, citable facts about a firm and a contact from FREE public sources:
//   1. the firm's own website (home + about / team / news / careers pages)
//   2. Google News RSS headlines about the firm and the contact
// An LLM extracts candidate facts, but EVERY fact must carry a verbatim quote, and the code checks
// that the quote really exists in the fetched text. Anything that cannot be verified is dropped.
// Only professional / business information is collected (nothing personal).

import { llmJson } from './llm'
import { fetchText, htmlToText, pageTitle, pickLinks, googleNews, normalizeWebsite } from './web'
import type { AbmAccount, AbmContact, ResearchFact, ResearchFactType, ResearchSource } from '@/lib/account-pursuit/types'

interface Doc { id: string; url: string; title: string; kind: 'website' | 'news'; text: string; date: string | null }

export interface ResearchResult {
  facts: ResearchFact[]
  sources: ResearchSource[]
  status: 'ok' | 'partial' | 'empty' | 'failed'
  note: string
}

const TYPES: ResearchFactType[] = ['trigger', 'hiring', 'growth', 'award', 'people', 'service', 'tech', 'other']
const PER_DOC_CHARS = 4500
const TOTAL_CHARS = 26_000

const norm = (s: string) => s.toLowerCase().replace(/[‘’“”]/g, "'").replace(/[^a-z0-9$%.' ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Distinctive words of a firm name (drops "LLP", "CPAs", "Group"...), used to match news to the right firm.
function firmTokens(name: string): string[] {
  const stop = new Set(['llc', 'llp', 'cpa', 'cpas', 'pc', 'inc', 'co', 'company', 'group', 'and', 'the', 'associates', 'advisors', 'advisory', 'accounting', 'accountants', 'services', 'firm', 'department'])
  return norm(name).split(' ').filter(t => t.length > 2 && !stop.has(t))
}

async function gatherDocs(account: AbmAccount, contact: AbmContact): Promise<{ docs: Doc[]; sources: ResearchSource[]; notes: string[] }> {
  const docs: Doc[] = []
  const sources: ResearchSource[] = []
  const notes: string[] = []
  let n = 0
  const add = (d: Omit<Doc, 'id'>): Doc => { const doc = { ...d, id: `s${++n}` }; docs.push(doc); return doc }

  // ── 1. the firm's own website ──
  const site = normalizeWebsite(account.website)
  if (!site) {
    notes.push(account.website ? 'website URL not usable' : 'no website on file')
  } else {
    const home = await fetchText(site.toString())
    if (!home.ok) {
      notes.push('website did not load')
      sources.push({ id: 'home', url: site.toString(), title: 'Website', kind: 'website', ok: false })
    } else {
      const base = new URL(home.finalUrl)
      const d = add({ url: home.finalUrl, title: pageTitle(home.body) || 'Home page', kind: 'website', text: htmlToText(home.body).slice(0, PER_DOC_CHARS), date: null })
      sources.push({ id: d.id, url: d.url, title: d.title, kind: 'website', ok: true })
      const links = pickLinks(home.body, base, 4)
      const pages = await Promise.all(links.map(l => fetchText(l)))
      pages.forEach((p, i) => {
        if (!p.ok) { sources.push({ id: `p${i}`, url: links[i], title: 'Page', kind: 'website', ok: false }); return }
        const text = htmlToText(p.body).slice(0, PER_DOC_CHARS)
        if (text.length < 80) return
        const doc = add({ url: p.finalUrl, title: pageTitle(p.body) || links[i], kind: 'website', text, date: null })
        sources.push({ id: doc.id, url: doc.url, title: doc.title, kind: 'website', ok: true })
      })
    }
  }

  // ── 2. news headlines: the firm, then the person ──
  const tokens = firmTokens(account.name)
  const firmQuery = `"${account.name.replace(/"/g, '')}"`
  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  const [firmNews, personNews] = await Promise.all([
    googleNews(firmQuery, 540, 10),
    contact.last_name ? googleNews(`"${fullName}" ${tokens[0] ? `"${tokens[0]}"` : ''}`.trim(), 900, 6) : Promise.resolve([]),
  ])
  // the headline must actually mention the firm (or, for people, the surname + the firm) — avoids look-alike firms
  const mentionsFirm = (t: string) => tokens.length === 0 ? false : tokens.every(tok => norm(t).includes(tok))
  for (const it of firmNews.filter(i => mentionsFirm(i.title)).slice(0, 5)) {
    const d = add({ url: it.link, title: `${it.title} (${it.publisher || 'news'})`, kind: 'news', text: `${it.title}${it.publisher ? ` - ${it.publisher}` : ''}`, date: it.date })
    sources.push({ id: d.id, url: d.url, title: d.title, kind: 'news', ok: true })
  }
  for (const it of personNews.filter(i => norm(i.title).includes(norm(contact.last_name ?? '')) && mentionsFirm(i.title)).slice(0, 3)) {
    const d = add({ url: it.link, title: `${it.title} (${it.publisher || 'news'})`, kind: 'news', text: `${it.title}${it.publisher ? ` - ${it.publisher}` : ''}`, date: it.date })
    sources.push({ id: d.id, url: d.url, title: d.title, kind: 'news', ok: true })
  }
  if (!docs.some(d => d.kind === 'news')) notes.push('no recent news found')
  return { docs, sources, notes }
}

function buildPrompt(docs: Doc[], account: AbmAccount, contact: AbmContact): { system: string; user: string } {
  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  let budget = TOTAL_CHARS
  const blocks: string[] = []
  // news headlines are tiny and the freshest signal: put them first so website pages can't crowd them out
  const ordered = [...docs].sort((x, y) => (x.kind === 'news' ? 0 : 1) - (y.kind === 'news' ? 0 : 1))
  for (const d of ordered) {
    if (budget <= 0) break
    const t = d.text.slice(0, Math.min(PER_DOC_CHARS, budget))
    budget -= t.length
    blocks.push(`[${d.id}] (${d.kind}${d.date ? `, ${d.date}` : ''}) ${d.url}\n${t}`)
  }
  const system = `You are a careful B2B research analyst. You extract facts ONLY from the SOURCES provided. You never use outside knowledge and never guess.

Collect only professional / business facts that would let a salesperson write a relevant, specific email to this firm:
- trigger: acquisition, merger, new office, new partner, leadership change, rebrand, major client/win, new service line
- hiring: open roles, hiring push, growth in headcount
- growth: size, locations, expansion, awards for growth
- award: rankings, awards, recognitions
- people: facts about the specific contact (their role, certifications, specialties, speaking, press), only if the source clearly refers to THIS person at THIS firm
- service: what the firm specialises in or who it serves
- tech: software or platforms the firm says it uses

Never collect: age, family, health, religion, politics, home address, social-life details, or anything not about their professional role.

For every fact you MUST give "evidence": an exact, word-for-word quote (max 220 characters) copied from the source. If you cannot quote it, leave the fact out. Prefer specific and recent facts over generic marketing language. Skip fluff such as "committed to excellence".

Return strict JSON only: {"facts":[{"subject":"firm"|"contact","type":"trigger|hiring|growth|award|people|service|tech|other","claim":"short neutral sentence","evidence":"exact quote","source":"s1"}]}  (maximum 12 facts, most useful first)`
  const user = `FIRM: ${account.name}${account.state ? `, ${account.state}` : ''}
CONTACT: ${fullName}, ${contact.job_title ?? 'title unknown'}
TODAY: ${new Date().toISOString().slice(0, 10)}

SOURCES
${blocks.join('\n\n---\n\n')}`
  return { system, user }
}

export async function runResearch(account: AbmAccount, contact: AbmContact): Promise<ResearchResult> {
  const { docs, sources, notes } = await gatherDocs(account, contact)
  if (docs.length === 0) {
    return { facts: [], sources, status: sources.length ? 'failed' : 'empty', note: notes.join('; ') || 'nothing to read' }
  }

  const { system, user } = buildPrompt(docs, account, contact)
  let raw: { facts?: { subject?: string; type?: string; claim?: string; evidence?: string; source?: string }[] } = {}
  try {
    raw = (await llmJson<typeof raw>({ system, user, temperature: 0.1 })).data
  } catch (e) {
    return { facts: [], sources, status: 'failed', note: `extraction failed: ${(e as Error).message.slice(0, 160)}` }
  }

  const byId = new Map(docs.map(d => [d.id, d]))
  const lastName = norm(contact.last_name ?? '')
  const facts: ResearchFact[] = []
  const seen = new Set<string>()
  let dropped = 0

  for (const f of raw.facts ?? []) {
    const doc = byId.get(String(f.source ?? ''))
    const claim = String(f.claim ?? '').replace(/\s+/g, ' ').trim()
    const evidence = String(f.evidence ?? '').replace(/\s+/g, ' ').trim()
    if (!doc || claim.length < 12 || evidence.length < 15) { dropped++; continue }
    // VERIFY: the quote must really appear in the source text
    if (!norm(doc.text).includes(norm(evidence))) { dropped++; continue }
    const subject = f.subject === 'contact' ? 'contact' : 'firm'
    // a "contact" fact must actually be about this person
    if (subject === 'contact' && (!lastName || !norm(`${claim} ${evidence}`).includes(lastName))) { dropped++; continue }
    const key = norm(claim)
    if (seen.has(key)) continue
    seen.add(key)
    const type = (TYPES as string[]).includes(f.type ?? '') ? (f.type as ResearchFactType) : 'other'
    facts.push({
      id: `f${facts.length + 1}`, subject, type, claim, evidence,
      source_url: doc.url, source_title: doc.title, date: doc.date,
    })
  }

  const status = facts.length === 0 ? 'empty' : notes.length ? 'partial' : 'ok'
  const note = [
    `${facts.length} verified fact${facts.length === 1 ? '' : 's'} from ${docs.length} source${docs.length === 1 ? '' : 's'}`,
    dropped ? `${dropped} unverifiable dropped` : '',
    ...notes,
  ].filter(Boolean).join('; ')
  return { facts, sources, status, note }
}
