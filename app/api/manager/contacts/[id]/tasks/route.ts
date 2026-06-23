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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error
  const { id } = await params
  const { data } = await supabase
    .from('contact_tasks').select('*, profiles!contact_tasks_user_id_fkey(name)')
    .eq('contact_id', id).order('due_date', { ascending: true, nullsFirst: false })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, error } = await requireManager()
  if (error) return error
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const { title, due_date, priority, notes } = body
  if (!title || !(title as string).trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  const { data, error: dbErr } = await supabase.from('contact_tasks').insert({
    contact_id: id, user_id: user!.id,
    title: (title as string).trim(),
    due_date: due_date || null,
    priority: priority || 'medium',
    notes: (notes as string)?.trim() || null,
  }).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, task: data })
}
