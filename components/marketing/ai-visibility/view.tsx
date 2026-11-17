'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Radar, RefreshCw, Loader2, Plus, Check, X, ChevronDown, ChevronRight, ExternalLink, Globe, ShieldCheck,
  SearchCheck, Sparkles, Bot, TrendingDown, TrendingUp,
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { scoreRun, trend, otherBrands, type RunLite, type AnswerLite, type BrandRow } from '@/lib/ai-visibility/metrics'

type Brand = BrandRow & { aliases: string[]; exclude: string[]; track_site: boolean; active: boolean; sites_checked_at: string | null }
type Question = { id: string; question: string; topic: string; source: string; active: boolean; created_at: string }
type Answer = AnswerLite & { id: string; model: string | null; answer: string | null; error: string | null; urls: string[] }
type Page = { id: string; brand_id: string; url: string; first_seen: string; changed_at: string | null; removed_at: string | null; baseline: boolean }
type Readiness = { id: string; brand_id: string; checked_at: string; passed: number; total: number; results: { key: string; label: string; ok: boolean; detail: string }[] }
type GscPage = { page: string; clicks: number; impressions: number; position: number | null; prev_clicks: number; prev_impressions: number; prev_position: number | null; snapshot_date: string }
type GscQuery = { query: string; clicks: number; impressions: number; position: number | null; top_page: string | null; snapshot_date: string }
type Suggestion = { id: string; question: string; reason: string | null; source: string; status: string; created_at: string }

type Data = {
  brands: Brand[]; questions: Question[]; runs: RunLite[]; answers: Answer[]; pages: Page[]
  readiness: Readiness[]; gscPages: GscPage[]; gscQueries: GscQuery[]; suggestions: Suggestion[]
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: Radar },
  { key: 'questions', label: 'Questions', icon: Bot },
  { key: 'suggestions', label: 'Suggestions', icon: Sparkles },
  { key: 'pages', label: 'Competitor pages', icon: Globe },
  { key: 'readiness', label: 'AI readiness', icon: ShieldCheck },
  { key: 'gsc', label: 'Search Console', icon: SearchCheck },
  { key: 'brands', label: 'Brands', icon: Plus },
] as const
type TabKey = typeof TABS[number]['key']

const COLORS = ['#e53935', '#0d9488', '#7c3aed', '#d97706', '#0284c7', '#db2777', '#64748b']
const card = 'bg-white border border-[#E5E5EA] rounded-2xl p-4'
const h2 = 'text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider'
const pct = (n: number) => `${Math.round(n * 100)}%`
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-')
const shortUrl = (u: string) => { try { const x = new URL(u); return x.pathname === '/' ? x.hostname : x.pathname } catch { return u } }

async function pageAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await q(from, from + 999)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

export default function AiVisibilityView() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const sb = createClient()
      const since = new Date(Date.now() - 45 * 86_400_000).toISOString()
      const [brands, questions, runs, answers, pages, readiness, gscPages, gscQueries, suggestions] = await Promise.all([
        sb.from('aiv_brands').select('*').order('is_us', { ascending: false }).order('name'),
        sb.from('aiv_questions').select('*').order('created_at'),
        sb.from('aiv_runs').select('*').order('started_at', { ascending: false }).limit(26),
        pageAll<Answer>((a, b) => sb.from('aiv_answers').select('id,run_id,question_id,engine,model,status,answer,error,mentions,brands_named,urls').order('created_at', { ascending: false }).range(a, b)),
        pageAll<Page>((a, b) => sb.from('aiv_pages').select('id,brand_id,url,first_seen,changed_at,removed_at,baseline').or(`first_seen.gte.${since},changed_at.gte.${since},removed_at.gte.${since}`).range(a, b)),
        sb.from('aiv_readiness').select('*').order('checked_at', { ascending: false }).limit(40),
        sb.from('aiv_gsc_pages').select('*').order('snapshot_date', { ascending: false }).limit(1000),
        sb.from('aiv_gsc_queries').select('*').order('snapshot_date', { ascending: false }).order('impressions', { ascending: false }).limit(300),
        sb.from('aiv_suggestions').select('*').order('created_at', { ascending: false }).limit(200),
      ])
      const firstErr = [brands, questions, runs, readiness, gscPages, gscQueries, suggestions].find(r => r.error)?.error
      if (firstErr) throw new Error(firstErr.message)
      setData({
        brands: (brands.data ?? []) as Brand[], questions: (questions.data ?? []) as Question[], runs: (runs.data ?? []) as RunLite[],
        answers, pages, readiness: (readiness.data ?? []) as Readiness[],
        gscPages: (gscPages.data ?? []) as GscPage[], gscQueries: (gscQueries.data ?? []) as GscQuery[], suggestions: (suggestions.data ?? []) as Suggestion[],
      })
    } catch (e) {
      const msg = (e as Error).message
      setError(/aiv_|relation|schema cache/i.test(msg)
        ? 'The AI Visibility tables are not in the database yet. Run supabase/ai_visibility_migration.sql in the Supabase SQL editor.'
        : `Could not load: ${msg}`)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function runNow() {
    if (!confirm('Run all checks now? Asking every question can take 5 to 15 minutes. Keep this tab open.')) return
    const plan: { step: string; label: string; loop: boolean }[] = [
      { step: 'ask', label: 'Asking AI models', loop: true },
      { step: 'sites', label: 'Reading sitemaps', loop: true },
      { step: 'readiness', label: 'Checking AI readiness', loop: false },
      { step: 'gsc', label: 'Reading Search Console', loop: false },
      { step: 'suggest', label: 'Suggesting new questions', loop: false },
    ]
    const notes: string[] = []
    for (const p of plan) {
      for (let i = 0, force = true; i < 80; i++) {
        setRunning(`${p.label}${p.loop && i ? ` (batch ${i + 1})` : ''}...`)
        const res = await fetch('/api/ai-visibility/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step: p.step, force }) })
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        if (j.error) { notes.push(`${p.label}: ${j.error}`); break }
        if (j.skipped) notes.push(`${p.label}: ${j.skipped}`)
        force = false
        if (!p.loop || j.done) break
        if (j.note === 'rate limited, will continue') await new Promise(r => setTimeout(r, 20_000))
      }
      await load()
    }
    setRunning('')
    if (notes.length) alert(notes.join('\n'))
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        {error ? <p className="text-[13px] text-rose-600 max-w-lg text-center">{error}</p> : <Loader2 size={22} className="animate-spin text-teal-600" />}
      </div>
    )
  }

  const pending = data.suggestions.filter(s => s.status === 'pending').length
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#1D1D1F] flex items-center gap-2"><Radar size={20} className="text-teal-600" /> AI Visibility</h1>
          <p className="text-[12px] text-[#6E6E73] mt-0.5">How often AI assistants name us vs competitors, what competitors publish, and whether AI can read our site. Runs every Monday.</p>
        </div>
        <button onClick={runNow} disabled={!!running}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-[12px] font-semibold px-3.5 py-2">
          {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {running || 'Run now'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold border ${tab === t.key ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]' : 'bg-white text-[#3A3A3C] border-[#E5E5EA] hover:bg-[#F5F5F7]'}`}>
            <t.icon size={13} /> {t.label}
            {t.key === 'suggestions' && pending > 0 && <span className="ml-0.5 rounded-full bg-rose-500 text-white text-[10px] px-1.5">{pending}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview data={data} />}
      {tab === 'questions' && <Questions data={data} reload={load} />}
      {tab === 'suggestions' && <Suggestions data={data} reload={load} />}
      {tab === 'pages' && <CompetitorPages data={data} />}
      {tab === 'readiness' && <ReadinessTab data={data} />}
      {tab === 'gsc' && <Gsc data={data} />}
      {tab === 'brands' && <Brands data={data} reload={load} />}
    </div>
  )
}

// ── Overview ────────────────────────────────────────────────────────────────

function Overview({ data }: { data: Data }) {
  const { latest, prev, scores, prevScores, chart, others } = useMemo(() => {
    const brands = data.brands.filter(b => b.active)
    const withAnswers = data.runs.filter(r => data.answers.some(a => a.run_id === r.id))
    const latest = withAnswers[0] ?? null
    const prev = withAnswers.find(r => r.status === 'done' && r.id !== latest?.id) ?? null
    const ans = (id?: string) => data.answers.filter(a => a.run_id === id)
    return {
      latest, prev,
      scores: latest ? scoreRun(ans(latest.id), brands) : [],
      prevScores: prev ? scoreRun(ans(prev.id), brands) : [],
      chart: trend(withAnswers.filter(r => r.status === 'done'), data.answers, brands),
      others: latest ? otherBrands(ans(latest.id), brands) : [],
    }
  }, [data])

  if (!latest) {
    return <div className={`${card} text-[13px] text-[#6E6E73]`}>No run yet. Click <b>Run now</b> to ask the AI models the {data.questions.filter(q => q.active).length} tracked questions, or wait for Monday&apos;s automatic run.</div>
  }
  const okCount = data.answers.filter(a => a.run_id === latest.id && a.status === 'ok').length
  const errCount = data.answers.filter(a => a.run_id === latest.id && a.status === 'error').length

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[#6E6E73]">
        Latest run {fmtDate(latest.started_at)} {latest.status === 'running' && <span className="text-amber-600 font-semibold">(still running)</span>} · {okCount} answers from {latest.engines.join(', ')}
        {errCount > 0 && <span className="text-rose-600"> · {errCount} failed</span>}
        {prev && <> · compared with {fmtDate(prev.started_at)}</>}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scores.map(s => {
          const p = prevScores.find(x => x.brand.id === s.brand.id)
          const delta = p ? Math.round((s.mentionRate - p.mentionRate) * 100) : null
          return (
            <div key={s.brand.id} className={`${card} ${s.brand.is_us ? 'ring-2 ring-rose-200' : ''}`}>
              <p className="text-[12px] font-semibold text-[#6E6E73] truncate">{s.brand.name}{s.brand.is_us && ' (us)'}</p>
              <div className="flex items-end gap-2 mt-1">
                <p className="text-[28px] font-extrabold text-[#1D1D1F] leading-none tabular-nums">{pct(s.mentionRate)}</p>
                {delta !== null && delta !== 0 && (
                  <span className={`text-[12px] font-semibold flex items-center gap-0.5 ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#AEAEB2] mt-1.5">of answers name it · share of voice {pct(s.shareOfVoice)}{s.avgPosition ? ` · avg rank #${s.avgPosition.toFixed(1)}` : ''}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} lg:col-span-2`}>
          <p className={`${h2} mb-2`}>Mention rate by week (%)</p>
          {chart.length < 2 ? <p className="text-[12px] text-[#AEAEB2] py-10 text-center">The trend appears after two weekly runs.</p> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {data.brands.filter(b => b.active).map((b, i) => (
                    <Line key={b.id} type="monotone" dataKey={b.name} stroke={COLORS[i % COLORS.length]} strokeWidth={b.is_us ? 3 : 2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className={card}>
          <p className={`${h2} mb-2`}>Who AI names instead</p>
          <p className="text-[11px] text-[#AEAEB2] mb-2">Companies named in the latest run that we don&apos;t track. Add real competitors on the Brands tab.</p>
          <ul className="space-y-1">
            {others.length === 0 && <li className="text-[12px] text-[#AEAEB2]">None</li>}
            {others.map(o => (
              <li key={o.name} className="flex justify-between text-[12px]"><span className="truncate">{o.name}</span><span className="tabular-nums text-[#6E6E73]">{o.count}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[11px] text-[#AEAEB2]">Free AI models answer from what they learned in training, not a live web search, so this measures how well-known each brand is to AI. Treat moves of a few points as noise.</p>
    </div>
  )
}

// ── Questions ───────────────────────────────────────────────────────────────

function Questions({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const latest = data.runs.find(r => data.answers.some(a => a.run_id === r.id))
  const brands = data.brands.filter(b => b.active)

  async function add() {
    const q = text.trim()
    if (q.length < 10) return
    setBusy(true)
    const { error } = await createClient().from('aiv_questions').insert({ question: q, source: 'manual' })
    setBusy(false)
    if (error) { alert(error.message.includes('duplicate') ? 'That question is already tracked.' : error.message); return }
    setText(''); await reload()
  }
  async function toggle(q: Question) {
    await createClient().from('aiv_questions').update({ active: !q.active }).eq('id', q.id)
    await reload()
  }

  return (
    <div className="space-y-3">
      <div className={`${card} flex gap-2`}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a question a US CPA firm owner might ask an AI assistant..."
          className="flex-1 min-w-0 rounded-xl border border-[#E5E5EA] px-3 py-2 text-[13px] outline-none focus:border-teal-500" />
        <button onClick={add} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-teal-600 text-white text-[12px] font-semibold px-3 disabled:opacity-60"><Plus size={14} /> Add</button>
      </div>
      <div className={`${card} p-0 overflow-x-auto`}>
        <table className="w-full text-[12px]">
          <thead><tr className="text-[#AEAEB2] text-[10px] uppercase tracking-wider border-b border-[#F0F0F2]">
            <th className="text-left font-semibold p-3">Question</th>
            {brands.map(b => <th key={b.id} className="font-semibold p-3 text-center whitespace-nowrap">{b.name.split(' ')[0]}</th>)}
            <th className="p-3 text-right font-semibold">Tracked</th>
          </tr></thead>
          <tbody className="divide-y divide-[#F0F0F2]">
            {data.questions.map(q => {
              const ans = data.answers.filter(a => a.run_id === latest?.id && a.question_id === q.id)
              return (
                <QuestionRow key={q.id} q={q} ans={ans} brands={brands} open={open === q.id}
                  onOpen={() => setOpen(open === q.id ? null : q.id)} onToggle={() => toggle(q)} />
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#AEAEB2]">Cell = rank in the AI&apos;s list in the latest run (&quot;named&quot; = in the text but not ranked). One cell per AI model, separated by /.</p>
    </div>
  )
}

function QuestionRow({ q, ans, brands, open, onOpen, onToggle }: { q: Question; ans: Answer[]; brands: Brand[]; open: boolean; onOpen: () => void; onToggle: () => void }) {
  const cell = (b: Brand) => {
    if (ans.length === 0) return <span className="text-[#D1D1D6]">-</span>
    return ans.map(a => {
      if (a.status !== 'ok') return '!'
      const p = a.mentions?.[b.id]
      return p === undefined ? '·' : p === 0 ? 'named' : `#${p}`
    }).join(' / ')
  }
  return (
    <>
      <tr className={q.active ? '' : 'opacity-50'}>
        <td className="p-3">
          <button onClick={onOpen} className="flex items-start gap-1 text-left hover:text-teal-700">
            {open ? <ChevronDown size={13} className="mt-0.5 shrink-0" /> : <ChevronRight size={13} className="mt-0.5 shrink-0" />}
            <span>{q.question} <span className="text-[10px] text-[#AEAEB2]">{q.topic !== 'general' ? q.topic : ''}{q.source !== 'seed' && q.source !== 'manual' ? ` · from ${q.source}` : ''}</span></span>
          </button>
        </td>
        {brands.map(b => {
          const named = ans.some(a => a.mentions?.[b.id] !== undefined)
          return <td key={b.id} className={`p-3 text-center whitespace-nowrap tabular-nums ${named ? (b.is_us ? 'text-rose-600 font-bold' : 'text-[#1D1D1F] font-semibold') : 'text-[#AEAEB2]'}`}>{cell(b)}</td>
        })}
        <td className="p-3 text-right"><input type="checkbox" checked={q.active} onChange={onToggle} /></td>
      </tr>
      {open && (
        <tr><td colSpan={brands.length + 2} className="bg-[#FAFAFB] p-3 space-y-3">
          {ans.length === 0 && <p className="text-[12px] text-[#AEAEB2]">Not asked yet.</p>}
          {ans.map(a => (
            <div key={a.id} className="text-[12px]">
              <p className="font-semibold text-[#3A3A3C]">{a.engine} <span className="font-normal text-[#AEAEB2]">{a.model}</span></p>
              {a.status === 'error' ? <p className="text-rose-600">{a.error}</p> : (
                <>
                  <p className="whitespace-pre-wrap text-[#3A3A3C] mt-1">{a.answer}</p>
                  {a.brands_named.length > 0 && <p className="text-[11px] text-[#6E6E73] mt-1">Named: {a.brands_named.map(n => n.name).join(', ')}</p>}
                </>
              )}
            </div>
          ))}
        </td></tr>
      )}
    </>
  )
}

// ── Suggestions ─────────────────────────────────────────────────────────────

function Suggestions({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const list = data.suggestions.filter(s => s.status === 'pending')
  async function decide(s: Suggestion, add: boolean) {
    const sb = createClient()
    if (add) {
      const { error } = await sb.from('aiv_questions').insert({ question: s.question, source: s.source === 'gsc' ? 'gsc' : 'ai' })
      if (error && !error.message.includes('duplicate')) { alert(error.message); return }
    }
    await sb.from('aiv_suggestions').update({ status: add ? 'added' : 'dismissed' }).eq('id', s.id)
    await reload()
  }
  return (
    <div className={`${card} p-0`}>
      {list.length === 0 && <p className="p-4 text-[12px] text-[#AEAEB2]">No new suggestions. They arrive every Monday from Search Console and from AI.</p>}
      <ul className="divide-y divide-[#F0F0F2]">
        {list.map(s => (
          <li key={s.id} className="p-3 flex items-start gap-3">
            <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${s.source === 'gsc' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>{s.source === 'gsc' ? 'GOOGLE' : 'AI'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#1D1D1F]">{s.question}</p>
              {s.reason && <p className="text-[11px] text-[#AEAEB2] mt-0.5">{s.reason}</p>}
            </div>
            <button onClick={() => decide(s, true)} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 text-white text-[11px] font-semibold px-2.5 py-1.5"><Check size={12} /> Track</button>
            <button onClick={() => decide(s, false)} className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5EA] text-[#6E6E73] text-[11px] font-semibold px-2.5 py-1.5"><X size={12} /> Dismiss</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Competitor pages ────────────────────────────────────────────────────────

function CompetitorPages({ data }: { data: Data }) {
  const weekAgo = Date.now() - 30 * 86_400_000
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.brands.filter(b => b.active && b.track_site).map(b => {
        const pages = data.pages.filter(p => p.brand_id === b.id)
        const added = pages.filter(p => !p.baseline && new Date(p.first_seen).getTime() >= weekAgo).sort((x, y) => y.first_seen.localeCompare(x.first_seen))
        const changed = pages.filter(p => p.changed_at && new Date(p.changed_at).getTime() >= weekAgo && !added.includes(p))
        const removed = pages.filter(p => p.removed_at && new Date(p.removed_at).getTime() >= weekAgo)
        return (
          <div key={b.id} className={card}>
            <div className="flex justify-between items-baseline mb-2">
              <p className={h2}>{b.name}</p>
              <p className="text-[11px] text-[#AEAEB2]">sitemap read {fmtDate(b.sites_checked_at)}</p>
            </div>
            <p className="text-[12px] text-[#6E6E73] mb-2">Last 30 days: <b className="text-[#1D1D1F]">{added.length}</b> new · {changed.length} updated · {removed.length} removed</p>
            <ul className="space-y-1 max-h-72 overflow-y-auto">
              {added.slice(0, 60).map(p => (
                <li key={p.id} className="text-[12px] flex gap-2"><span className="text-emerald-600 font-bold text-[10px] mt-0.5">NEW</span>
                  <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:text-teal-700">{shortUrl(p.url)}</a>
                  <span className="ml-auto text-[#AEAEB2] shrink-0">{fmtDate(p.first_seen)}</span></li>
              ))}
              {changed.slice(0, 30).map(p => (
                <li key={p.id} className="text-[12px] flex gap-2"><span className="text-amber-600 font-bold text-[10px] mt-0.5">UPD</span>
                  <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:text-teal-700">{shortUrl(p.url)}</a>
                  <span className="ml-auto text-[#AEAEB2] shrink-0">{fmtDate(p.changed_at)}</span></li>
              ))}
              {added.length + changed.length === 0 && <li className="text-[12px] text-[#AEAEB2]">{b.sites_checked_at ? 'No changes yet. The first read only records the starting point.' : 'Not read yet.'}</li>}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

// ── AI readiness ────────────────────────────────────────────────────────────

function ReadinessTab({ data }: { data: Data }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.brands.filter(b => b.active && b.track_site).map(b => {
        const r = data.readiness.find(x => x.brand_id === b.id)
        return (
          <div key={b.id} className={`${card} ${b.is_us ? 'lg:col-span-2' : ''}`}>
            <div className="flex justify-between items-baseline mb-2">
              <p className={h2}>{b.name}</p>
              {r && <p className="text-[12px]"><b className={r.passed === r.total ? 'text-emerald-600' : 'text-amber-600'}>{r.passed}/{r.total}</b> <span className="text-[#AEAEB2]">· {fmtDate(r.checked_at)}</span></p>}
            </div>
            {!r ? <p className="text-[12px] text-[#AEAEB2]">Not checked yet.</p> : (
              <ul className="space-y-1">
                {r.results.map(c => (
                  <li key={c.key} className="text-[12px] flex gap-2">
                    {c.ok ? <Check size={14} className="text-emerald-600 shrink-0" /> : <X size={14} className="text-rose-600 shrink-0" />}
                    <span className="text-[#1D1D1F]">{c.label}</span><span className="text-[#AEAEB2] truncate">{c.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Search Console ──────────────────────────────────────────────────────────

function Gsc({ data }: { data: Data }) {
  const snap = data.gscPages[0]?.snapshot_date
  if (!snap) {
    return (
      <div className={`${card} text-[13px] text-[#6E6E73] space-y-1`}>
        <p>No Search Console data yet.</p>
        <p className="text-[12px]">Setup: a Google service account key must be added to Vercel (GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY) and that service account added as a user on the Search Console property.</p>
      </div>
    )
  }
  const pages = data.gscPages.filter(p => p.snapshot_date === snap)
  const losers = [...pages].sort((a, b) => (a.clicks - a.prev_clicks) - (b.clicks - b.prev_clicks)).filter(p => p.clicks < p.prev_clicks).slice(0, 25)
  const qSnap = data.gscQueries[0]?.snapshot_date
  const queries = data.gscQueries.filter(q => q.snapshot_date === qSnap).slice(0, 40)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <p className={`${h2} mb-1`}>Pages losing Google clicks</p>
        <p className="text-[11px] text-[#AEAEB2] mb-2">Last 28 days vs the 28 before · snapshot {fmtDate(snap)}. Google AI Overviews follow these rankings.</p>
        <table className="w-full text-[12px]">
          <thead><tr className="text-[#AEAEB2] text-[10px] uppercase"><th className="text-left pb-1">Page</th><th className="text-right pb-1">Clicks</th><th className="text-right pb-1">Before</th><th className="text-right pb-1">Pos.</th></tr></thead>
          <tbody className="divide-y divide-[#F0F0F2]">
            {losers.map(p => (
              <tr key={p.page}><td className="py-1 pr-2 max-w-[260px] truncate"><a href={p.page} target="_blank" rel="noreferrer" className="hover:text-teal-700">{shortUrl(p.page)}</a></td>
                <td className="text-right tabular-nums">{p.clicks}</td><td className="text-right tabular-nums text-[#6E6E73]">{p.prev_clicks}</td>
                <td className="text-right tabular-nums text-[#6E6E73]">{p.position ?? '-'}{p.prev_position ? ` (${p.prev_position})` : ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={card}>
        <p className={`${h2} mb-1`}>Questions people Google before finding us</p>
        <p className="text-[11px] text-[#AEAEB2] mb-2">Question-style searches, last 28 days, by impressions.</p>
        <table className="w-full text-[12px]">
          <thead><tr className="text-[#AEAEB2] text-[10px] uppercase"><th className="text-left pb-1">Query</th><th className="text-right pb-1">Impr.</th><th className="text-right pb-1">Clicks</th><th className="text-right pb-1">Pos.</th></tr></thead>
          <tbody className="divide-y divide-[#F0F0F2]">
            {queries.map(q => (
              <tr key={q.query}><td className="py-1 pr-2">{q.query}</td><td className="text-right tabular-nums">{q.impressions}</td>
                <td className="text-right tabular-nums">{q.clicks}</td><td className="text-right tabular-nums text-[#6E6E73]">{q.position ?? '-'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Brands ──────────────────────────────────────────────────────────────────

function Brands({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [aliases, setAliases] = useState('')
  async function add() {
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    if (!name.trim() || !d.includes('.')) { alert('Enter a name and a domain like example.com'); return }
    const list = aliases.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const { error } = await createClient().from('aiv_brands').insert({ name: name.trim(), domain: d, aliases: list.length ? list : [name.trim().toLowerCase()] })
    if (error) { alert(error.message); return }
    setName(''); setDomain(''); setAliases(''); await reload()
  }
  async function toggle(b: Brand) {
    await createClient().from('aiv_brands').update({ active: !b.active }).eq('id', b.id)
    await reload()
  }
  return (
    <div className="space-y-3">
      <div className={`${card} grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]`}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Competitor name" className="rounded-xl border border-[#E5E5EA] px-3 py-2 text-[13px]" />
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="domain.com" className="rounded-xl border border-[#E5E5EA] px-3 py-2 text-[13px]" />
        <input value={aliases} onChange={e => setAliases(e.target.value)} placeholder="Other names, comma separated" className="rounded-xl border border-[#E5E5EA] px-3 py-2 text-[13px]" />
        <button onClick={add} className="inline-flex items-center justify-center gap-1 rounded-xl bg-teal-600 text-white text-[12px] font-semibold px-3 py-2"><Plus size={14} /> Add</button>
      </div>
      <div className={`${card} p-0`}>
        <ul className="divide-y divide-[#F0F0F2]">
          {data.brands.map(b => (
            <li key={b.id} className={`p-3 flex items-center gap-3 text-[12px] ${b.active ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1D1D1F]">{b.name}{b.is_us && ' (us)'} <a href={`https://${b.domain}`} target="_blank" rel="noreferrer" className="font-normal text-[#6E6E73] hover:text-teal-700 inline-flex items-center gap-0.5">{b.domain} <ExternalLink size={10} /></a></p>
                <p className="text-[11px] text-[#AEAEB2] truncate">Counts as a mention: {b.aliases.join(', ')}{b.exclude.length ? ` · ignored: ${b.exclude.join(', ')}` : ''}</p>
              </div>
              {!b.is_us && <label className="flex items-center gap-1 text-[#6E6E73]"><input type="checkbox" checked={b.active} onChange={() => toggle(b)} /> tracked</label>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
