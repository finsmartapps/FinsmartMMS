import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [{ data: followups }, { data: meetings }, { data: activity }, { data: calls }, { data: tasks }] = await Promise.all([
    supabase
      .from('follow_ups')
      .select('id, follow_up_date, notes, status, created_at')
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .order('follow_up_date', { ascending: false }),
    supabase
      .from('meetings')
      .select('id, meeting_date, meeting_time, timezone, notes, outcome, company_name, lead_source, created_at')
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .order('meeting_date', { ascending: false }),
    supabase
      .from('linkedin_contact_activity')
      .select('id, action, detail, created_at, profiles(name)')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('contact_calls')
      .select('*')
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .order('call_date', { ascending: false }),
    supabase
      .from('contact_tasks')
      .select('*')
      .eq('contact_id', id)
      .eq('user_id', user.id)
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
