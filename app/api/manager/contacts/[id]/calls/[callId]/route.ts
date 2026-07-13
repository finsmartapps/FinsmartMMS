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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; callId: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error
  const { callId } = await params
  const { error: dbErr } = await supabase.from('contact_calls').delete().eq('id', callId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
