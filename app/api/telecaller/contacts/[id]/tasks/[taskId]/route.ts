import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await params
  const body = await req.json() as Record<string, unknown>
  const update: Record<string, unknown> = {}

  if ('status' in body) {
    update.status = body.status
    update.completed_at = body.status === 'completed' ? new Date().toISOString() : null
  }
  if ('title' in body && (body.title as string)?.trim()) update.title = (body.title as string).trim()
  if ('due_date' in body) update.due_date = body.due_date || null
  if ('priority' in body) update.priority = body.priority
  if ('notes' in body) update.notes = (body.notes as string)?.trim() || null

  const { data, error } = await supabase
    .from('contact_tasks').update(update).eq('id', taskId).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, task: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await params
  const { error } = await supabase.from('contact_tasks').delete().eq('id', taskId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
