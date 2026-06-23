import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/telecaller/linkedin/contacts/[id]/activity
// Returns the activity log for a contact the current user is assigned to.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify the contact belongs to this telecaller
  const { data: contact } = await supabase
    .from('linkedin_contacts')
    .select('id')
    .eq('id', id)
    .eq('assigned_to', user.id)
    .single()
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: activity, error } = await supabase
    .from('linkedin_contact_activity')
    .select('id, action, detail, created_at, user_id, profiles(name)')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: activity ?? [] })
}
