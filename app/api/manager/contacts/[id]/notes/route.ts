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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, error } = await requireManager()
  if (error) return error

  const { id } = await params
  const { note } = await req.json() as { note?: string }
  if (!note?.trim()) return NextResponse.json({ error: 'Note text is required.' }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('linkedin_contact_activity').insert({
    contact_id: id,
    user_id: user!.id,
    action: 'note_added',
    detail: note.trim(),
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, activity: data })
}
