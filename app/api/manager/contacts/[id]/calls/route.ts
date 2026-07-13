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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error
  const { id } = await params
  const { data } = await supabase
    .from('contact_calls')
    .select('*, profiles!contact_calls_user_id_fkey(name)')
    .eq('contact_id', id)
    .order('call_date', { ascending: false })
  return NextResponse.json({ calls: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, error } = await requireManager()
  if (error) return error
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const { call_date, call_time, duration_mins, outcome, notes } = body
  const { data, error: dbErr } = await supabase.from('contact_calls').insert({
    contact_id: id, user_id: user!.id,
    call_date: call_date ?? new Date().toISOString().split('T')[0],
    call_time: call_time || null,
    duration_mins: duration_mins ? Number(duration_mins) : null,
    outcome: outcome || null,
    notes: (notes as string)?.trim() || null,
  }).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  try {
    await supabase.from('linkedin_contact_activity').insert({
      contact_id: id, user_id: user!.id, action: 'call_logged',
      detail: `Call logged — ${outcome ? (outcome as string).replace('_', ' ') : 'outcome not set'}${duration_mins ? ` · ${duration_mins} min` : ''}`,
    })
  } catch { /* swallow */ }
  return NextResponse.json({ ok: true, call: data })
}
