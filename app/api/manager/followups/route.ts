import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function assertManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager' && profile?.role !== 'admin' && profile?.role !== 'manager') return null
  return user
}

// GET /api/manager/followups
// Query params: user_id, status, date_from, date_to, search
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  if (!await assertManager(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId   = searchParams.get('user_id') ?? ''
  const status   = searchParams.get('status') ?? ''
  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo   = searchParams.get('date_to') ?? ''
  const search   = searchParams.get('search') ?? ''

  // Fetch telecallers list for the filter dropdown
  const { data: telecallers } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'telecaller')
    .order('name')

  // Build follow-ups query with joins
  let query = supabase
    .from('follow_ups')
    .select('*, profiles(id, name)')
    .order('follow_up_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (userId)   query = query.eq('user_id', userId)
  if (status)   query = query.eq('status', status)
  if (dateFrom) query = query.gte('follow_up_date', dateFrom)
  if (dateTo)   query = query.lte('follow_up_date', dateTo)

  const { data: followups, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date().toISOString().split('T')[0]

  // Apply search client-side (simple text filter after DB fetch)
  const q = search.trim().toLowerCase()
  const filtered = q
    ? (followups ?? []).filter((f: Record<string, string>) =>
        `${f.first_name} ${f.last_name}`.toLowerCase().includes(q) ||
        (f.company_name ?? '').toLowerCase().includes(q) ||
        (f.phone ?? '').toLowerCase().includes(q) ||
        (f.notes ?? '').toLowerCase().includes(q)
      )
    : (followups ?? [])

  // Stats over the entire unfiltered result (same filters except search)
  const all = followups ?? []
  const stats = {
    total:    all.length,
    pending:  all.filter((f: { status: string }) => f.status === 'pending').length,
    done:     all.filter((f: { status: string }) => f.status === 'done').length,
    overdue:  all.filter((f: { status: string; follow_up_date: string }) => f.status === 'pending' && f.follow_up_date < today).length,
  }

  return NextResponse.json({ followups: filtered, stats, telecallers: telecallers ?? [] })
}
