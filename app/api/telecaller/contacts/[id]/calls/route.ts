import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('contact_calls')
    .select('*')
    .eq('contact_id', id)
    .eq('user_id', user.id)
    .order('call_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ calls: data ?? [] })
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
  const { call_date, call_time, duration_mins, outcome, notes } = body

  const { data, error } = await supabase.from('contact_calls').insert({
    contact_id: id,
    user_id: user.id,
    call_date: call_date ?? new Date().toISOString().split('T')[0],
    call_time: call_time || null,
    duration_mins: duration_mins ? Number(duration_mins) : null,
    outcome: outcome || null,
    notes: (notes as string)?.trim() || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  try {
    await supabase.from('linkedin_contact_activity').insert({
      contact_id: id, user_id: user.id,
      action: 'call_logged',
      detail: `Call logged — ${outcome ? (outcome as string).replace('_', ' ') : 'outcome not set'}${duration_mins ? ` · ${duration_mins} min` : ''}`,
    })
  } catch { /* swallow */ }

  return NextResponse.json({ ok: true, call: data })
}
