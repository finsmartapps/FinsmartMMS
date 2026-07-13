import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager' && profile?.role !== 'admin' && profile?.role !== 'manager') return { supabase, user, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase, user, error: null }
}

export async function GET() {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { data, error: dbErr } = await supabase.from('settings').select('key, value')
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
  return NextResponse.json({
    submission_deadline: map['submission_deadline'] ?? '05:00',
    day_reset_time: map['day_reset_time'] ?? '15:00',
    submission_always_open: map['submission_always_open'] === 'true',
    linkedin_daily_quota: parseInt(map['linkedin_daily_quota'] ?? '15', 10),
  })
}

export async function PATCH(req: NextRequest) {
  const { supabase, user, error } = await requireManager()
  if (error) return error

  const body = await req.json()
  const { linkedin_daily_quota } = body

  if (linkedin_daily_quota !== undefined) {
    const q = parseInt(linkedin_daily_quota, 10)
    if (isNaN(q) || q < 1 || q > 100)
      return NextResponse.json({ error: 'LinkedIn daily quota must be between 1 and 100.' }, { status: 400 })

    const { error: e } = await supabase.from('settings').upsert(
      { key: 'linkedin_daily_quota', value: String(q), updated_by: user!.id, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
