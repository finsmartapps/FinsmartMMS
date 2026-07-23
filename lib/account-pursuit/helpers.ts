import { createClient } from '@/lib/supabase/client'

// Current user id + whether they're a manager (for scope decisions in the UI).
export async function getViewer(): Promise<{ id: string; isManager: boolean } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  return { id: user.id, isManager: profile?.role === 'manager' || profile?.role === 'admin' }
}

// Add N business days (skip Sat/Sun) to today; returns YYYY-MM-DD.
export function businessDaysFromToday(days: number): string {
  const d = new Date()
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Relative "due" label: overdue / today / in N days.
export function dueLabel(iso: string | null): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' | 'none' } {
  if (!iso) return { text: 'No next step', tone: 'none' }
  const today = new Date(todayISO()).getTime()
  const due = new Date(iso).getTime()
  const days = Math.round((due - today) / 86400000)
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, tone: 'overdue' }
  if (days === 0) return { text: 'Due today', tone: 'today' }
  if (days <= 3) return { text: `In ${days}d`, tone: 'soon' }
  return { text: `In ${days}d`, tone: 'later' }
}

export function fullName(c: { first_name: string; last_name: string | null }): string {
  return `${c.first_name} ${c.last_name ?? ''}`.trim()
}

// Parse "$10.6M" / "$1.2B" / "500000" → numeric USD.
export function parseRevenue(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = String(raw).replace(/[$,\s]/g, '').toUpperCase()
  const m = s.match(/^([\d.]+)([KMB])?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (Number.isNaN(n)) return null
  const mult = m[2] === 'B' ? 1e9 : m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1
  return Math.round(n * mult * 100) / 100
}

// Auto-tier from revenue + employee size (defaults; adjustable later).
export function autoTier(revenueUsd: number | null, employees: number | null): 'A' | 'B' | 'C' {
  if ((revenueUsd ?? 0) >= 25e6 || (employees ?? 0) >= 250) return 'A'
  if ((revenueUsd ?? 0) >= 10e6 || (employees ?? 0) >= 50) return 'B'
  return 'C'
}

// Guess committee role from a job title.
export function guessRole(title: string | null | undefined): 'decision_maker' | 'influencer' | 'gatekeeper' | 'unknown' {
  const t = (title ?? '').toLowerCase()
  if (!t) return 'unknown'
  if (/(ceo|cfo|coo|president|owner|partner|principal|founder|managing|shareholder|director)/.test(t)) return 'decision_maker'
  if (/(manager|controller|lead|head)/.test(t)) return 'influencer'
  if (/(assistant|coordinator|admin|receptionist)/.test(t)) return 'gatekeeper'
  return 'unknown'
}
