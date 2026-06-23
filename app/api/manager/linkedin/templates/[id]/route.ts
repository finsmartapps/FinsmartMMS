import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'manager') return { supabase, user, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase, user, error: null }
}

// PATCH /api/manager/linkedin/templates/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if ('name' in body) update.name = body.name?.trim()
  if ('body' in body) update.body = body.body?.trim()
  if ('is_active' in body) update.is_active = !!body.is_active

  const { error: e } = await supabase
    .from('linkedin_message_templates')
    .update(update)
    .eq('id', id)

  if (e) return NextResponse.json({ error: e.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/manager/linkedin/templates/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { id } = await params
  const { error: e } = await supabase.from('linkedin_message_templates').delete().eq('id', id)
  if (e) return NextResponse.json({ error: e.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
