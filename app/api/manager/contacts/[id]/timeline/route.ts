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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error
  const { id } = await params

  const [{ data: followups }, { data: meetings }, { data: activity }, { data: calls }, { data: tasks }] = await Promise.all([
    supabase
      .from('follow_ups')
      .select('id, follow_up_date, notes, status, created_at, profiles!follow_ups_user_id_fkey(name)')
      .eq('contact_id', id)
      .order('follow_up_date', { ascending: false }),
    supabase
      .from('meetings')
      .select('id, meeting_date, meeting_time, timezone, notes, outcome, company_name, lead_source, created_at, profiles!meetings_user_id_fkey(name)')
      .eq('contact_id', id)
      .order('meeting_date', { ascending: false }),
    supabase
      .from('linkedin_contact_activity')
      .select('id, action, detail, created_at, profiles(name)')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('contact_calls')
      .select('*, profiles!contact_calls_user_id_fkey(name)')
      .eq('contact_id', id)
      .order('call_date', { ascending: false }),
    supabase
      .from('contact_tasks')
      .select('*, profiles!contact_tasks_user_id_fkey(name)')
      .eq('contact_id', id)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  return NextResponse.json({
    followups: followups ?? [],
    meetings: meetings ?? [],
    activity: activity ?? [],
    calls: calls ?? [],
    tasks: tasks ?? [],
  })
}
