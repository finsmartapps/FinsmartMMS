import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function assertManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager') return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  if (!await assertManager(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all meetings joined with telecaller profile name
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*, profiles(name, email)')
    .order('meeting_date', { ascending: false })
    .order('meeting_time', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meetings })
}
