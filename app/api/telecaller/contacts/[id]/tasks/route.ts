import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('contact_tasks')
    .select('*')
    .eq('contact_id', id)
    .eq('user_id', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: contact } = await supabase
    .from('linkedin_contacts').select('id').eq('id', id).eq('assigned_to', user.id).single()
  if (!contact) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })

  const body = await req.json() as Record<string, unknown>
  const { title, due_date, priority, notes } = body
  if (!title || !(title as string).trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

  const { data, error } = await supabase.from('contact_tasks').insert({
    contact_id: id,
    user_id: user.id,
    title: (title as string).trim(),
    due_date: due_date || null,
    priority: priority || 'medium',
    notes: (notes as string)?.trim() || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, task: data })
}
