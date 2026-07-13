import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'manager' && p?.role !== 'admin') return { supabase, user, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase, user, error: null }
}

// GET /api/manager/linkedin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  // Fetch sent contacts in period + all contacts + telecallers in parallel
  const [sentRes, profilesRes, allRes] = await Promise.all([
    supabase
      .from('linkedin_contacts')
      .select('id, assigned_to, request_sent_at')
      .eq('status', 'request_sent')
      .gte('request_sent_at', from + 'T00:00:00.000Z')
      .lte('request_sent_at', to + 'T23:59:59.999Z'),
    supabase.from('profiles').select('id, name').eq('role', 'telecaller').eq('is_active', true),
    supabase.from('linkedin_contacts').select('id, assigned_to, status'),
  ])

  const sent = sentRes.data ?? []
  const profiles = profilesRes.data ?? []
  const allContacts = allRes.data ?? []

  // ── Daily trend ──────────────────────────────────────────────────────────────
  const dailyMap: Record<string, number> = {}
  for (const c of sent) {
    const day = c.request_sent_at!.split('T')[0]
    dailyMap[day] = (dailyMap[day] ?? 0) + 1
  }
  const dailyTrend: { date: string; sent: number }[] = []
  const d = new Date(from + 'T12:00:00Z')
  const end = new Date(to + 'T12:00:00Z')
  while (d <= end) {
    const ds = d.toISOString().split('T')[0]
    dailyTrend.push({ date: ds, sent: dailyMap[ds] ?? 0 })
    d.setUTCDate(d.getUTCDate() + 1)
  }

  // ── Per-telecaller leaderboard ───────────────────────────────────────────────
  const profileMap = Object.fromEntries(profiles.map((p: { id: string; name: string }) => [p.id, p.name]))

  const tcSent: Record<string, number> = {}
  for (const c of sent) if (c.assigned_to) tcSent[c.assigned_to] = (tcSent[c.assigned_to] ?? 0) + 1

  const tcTotal: Record<string, number> = {}
  const tcPending: Record<string, number> = {}
  const tcAllSent: Record<string, number> = {}
  for (const c of allContacts) {
    if (!c.assigned_to) continue
    tcTotal[c.assigned_to] = (tcTotal[c.assigned_to] ?? 0) + 1
    if (c.status === 'queued') tcPending[c.assigned_to] = (tcPending[c.assigned_to] ?? 0) + 1
    if (c.status === 'request_sent') tcAllSent[c.assigned_to] = (tcAllSent[c.assigned_to] ?? 0) + 1
  }

  const telecallerStats = Object.entries(tcTotal).map(([id, total]) => ({
    id,
    name: profileMap[id] ?? 'Unknown',
    sent: tcAllSent[id] ?? 0,
    total,
    pending: tcPending[id] ?? 0,
    sentInPeriod: tcSent[id] ?? 0,
  })).sort((a, b) => b.sentInPeriod - a.sentInPeriod)

  // ── KPI summary ──────────────────────────────────────────────────────────────
  const totalSentPeriod = sent.length
  const totalSentAllTime = allContacts.filter((c: { status: string }) => c.status === 'request_sent').length
  const totalAssigned = allContacts.length
  const totalPending = allContacts.filter((c: { status: string }) => c.status === 'queued').length

  return NextResponse.json({
    summary: { totalSentPeriod, totalSentAllTime, totalAssigned, totalPending },
    dailyTrend,
    telecallerStats,
  })
}
