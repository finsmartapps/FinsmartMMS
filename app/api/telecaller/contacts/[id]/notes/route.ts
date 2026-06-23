import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { note } = await req.json() as { note?: string }
  if (!note?.trim()) return NextResponse.json({ error: 'Note text is required.' }, { status: 400 })

  // Verify contact belongs to this telecaller
  const { data: contact } = await supabase
    .from('linkedin_contacts').select('id').eq('id', id).eq('assigned_to', user.id).single()
  if (!contact) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })

  const { data, error } = await supabase.from('linkedin_contact_activity').insert({
    contact_id: id,
    user_id: user.id,
    action: 'note_added',
    detail: note.trim(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, activity: data })
}
