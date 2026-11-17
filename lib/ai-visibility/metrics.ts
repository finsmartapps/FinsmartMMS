// Pure scoring for the AI Visibility page. Unit-testable, no I/O.

export type RunLite = { id: string; started_at: string; finished_at: string | null; status: string; engines: string[] }
export type AnswerLite = {
  run_id: string
  question_id: string
  engine: string
  status: string
  mentions: Record<string, number>
  brands_named: { name: string; website?: string }[]
}
export type BrandRow = { id: string; name: string; domain: string; is_us: boolean }

export type BrandScore = {
  brand: BrandRow
  mentionRate: number   // share of answers that name the brand
  avgPosition: number | null // average rank where the model ranked it (1 = first)
  shareOfVoice: number  // brand mentions / all tracked-brand mentions
  answers: number
}

export function scoreRun(answers: AnswerLite[], brands: BrandRow[]): BrandScore[] {
  const ok = answers.filter(a => a.status === 'ok')
  const totalMentions = ok.reduce((s, a) => s + brands.filter(b => b.id in (a.mentions ?? {})).length, 0)
  return brands.map(brand => {
    const hits = ok.filter(a => brand.id in (a.mentions ?? {}))
    const ranked = hits.map(a => a.mentions[brand.id]).filter(p => p > 0)
    return {
      brand,
      mentionRate: ok.length ? hits.length / ok.length : 0,
      avgPosition: ranked.length ? ranked.reduce((s, p) => s + p, 0) / ranked.length : null,
      shareOfVoice: totalMentions ? hits.length / totalMentions : 0,
      answers: ok.length,
    }
  }).sort((a, b) => b.mentionRate - a.mentionRate)
}

// Mention rate per brand per finished run, oldest first, for the trend chart.
export function trend(runs: RunLite[], answers: AnswerLite[], brands: BrandRow[]): Record<string, string | number>[] {
  const byRun = new Map<string, AnswerLite[]>()
  for (const a of answers) {
    if (!byRun.has(a.run_id)) byRun.set(a.run_id, [])
    byRun.get(a.run_id)!.push(a)
  }
  return [...runs]
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .filter(r => byRun.has(r.id))
    .map(r => {
      const row: Record<string, string | number> = { date: r.started_at.slice(0, 10) }
      for (const s of scoreRun(byRun.get(r.id)!, brands)) row[s.brand.name] = Math.round(s.mentionRate * 100)
      return row
    })
}

// Brands the models recommend that we do not track yet (possible new competitors).
export function otherBrands(answers: AnswerLite[], brands: BrandRow[], limit = 15): { name: string; count: number }[] {
  const tracked = brands.flatMap(b => [b.name.toLowerCase(), b.domain.toLowerCase().split('.')[0]])
  const counts = new Map<string, { name: string; count: number }>()
  for (const a of answers) {
    if (a.status !== 'ok') continue
    const seen = new Set<string>()
    for (const n of a.brands_named ?? []) {
      const key = n.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(inc|llc|ltd|pvt|services|accounting)\b/g, '').trim()
      if (key.length < 3 || seen.has(key)) continue
      if (tracked.some(t => key.includes(t.replace(/[^a-z0-9 ]/g, '')) || t.includes(key))) continue
      seen.add(key)
      const e = counts.get(key) ?? { name: n.name, count: 0 }
      e.count++
      counts.set(key, e)
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}
