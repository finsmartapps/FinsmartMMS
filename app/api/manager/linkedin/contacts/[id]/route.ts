import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'email', 'phone',
  'company_name', 'job_title', 'linkedin_url', 'lead_source',
  'city', 'country', 'notes',
] as const

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'manager' && p?.role !== 'admin') return { supabase, user, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase, user, error: null }
}

// PATCH /api/manager/linkedin/contacts/[id] — edit any contact
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const update: Record<string, unknown> = {}

  if (body.status === 'request_sent') {
    update.status = 'request_sent'
    update.request_sent_at = new Date().toISOString()
  } else if (body.status === 'queued') {
    update.status = 'queued'
    update.request_sent_at = null
  }

  for (const f of EDITABLE_FIELDS) {
    if (f in body) {
      const v = body[f]
      if (typeof v === 'string') update[f] = v.trim() || (f === 'first_name' ? '' : null)
      else if (v === null) update[f] = null
    }
  }

  if ('first_name' in update && !update.first_name)
    return NextResponse.json({ error: 'First name cannot be empty.' }, { status: 400 })

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('linkedin_contacts')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, contact: data })
}

// DELETE /api/manager/linkedin/contacts/[id] — delete a single contact
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { id } = await params
  const { error: dbErr } = await supabase.from('linkedin_contacts').delete().eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
