import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getManagerSupabase() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, forbidden: true }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager') return { supabase, user, forbidden: true }
  return { supabase, user, forbidden: false }
}

// PATCH /api/manager/logs/[logId]
// Body: { entries: [{ activityId, value, deficitReason }] }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { supabase, forbidden } = await getManagerSupabase()
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { logId } = await params
  const body = await req.json() as {
    entries: { activityId: string; value: number; deficitReason: string | null }[]
  }

  // Upsert entries (log_id + activity_id is unique)
  const rows = body.entries.map(e => ({
    log_id: logId,
    activity_id: e.activityId,
    value: e.value,
    deficit_reason: e.deficitReason?.trim() || null,
  }))

  const { error } = await supabase
    .from('daily_log_entries')
    .upsert(rows, { onConflict: 'log_id,activity_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/manager/logs/[logId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { supabase, forbidden } = await getManagerSupabase()
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { logId } = await params

  // Entries cascade automatically (FK on delete cascade)
  const { error } = await supabase.from('daily_logs').delete().eq('id', logId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
