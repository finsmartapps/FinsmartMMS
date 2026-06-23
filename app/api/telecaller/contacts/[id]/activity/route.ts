import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/telecaller/contacts/[id]/activity
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: activity, error: dbErr } = await supabase
    .from('linkedin_contact_activity')
    .select('id, action, detail, created_at, user_id, profiles(name)')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ activity: activity ?? [] })
}
