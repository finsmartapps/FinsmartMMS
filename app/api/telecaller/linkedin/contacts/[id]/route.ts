import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Fields the telecaller is allowed to edit on their own contacts
const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'email', 'phone',
  'company_name', 'job_title', 'linkedin_url', 'lead_source',
  'city', 'country', 'notes',
] as const

// PATCH /api/telecaller/linkedin/contacts/[id]
// Body may contain:
//   - status: 'request_sent' | 'queued'  (toggle done / undo)
//   - any editable contact field
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const update: Record<string, unknown> = {}

  // Status transitions (with sent timestamp bookkeeping)
  if (body.status === 'request_sent') {
    update.status = 'request_sent'
    update.request_sent_at = new Date().toISOString()
  } else if (body.status === 'queued') {
    update.status = 'queued'
    update.request_sent_at = null
  }

  // Plain editable field copy
  for (const f of EDITABLE_FIELDS) {
    if (f in body) {
      const v = body[f]
      // Trim strings to null when empty
      if (typeof v === 'string') {
        update[f] = v.trim() || (f === 'first_name' ? '' : null)
      } else if (v === null) {
        update[f] = null
      }
    }
  }

  // Validate: first_name cannot be cleared
  if ('first_name' in update && !update.first_name) {
    return NextResponse.json({ error: 'First name cannot be empty.' }, { status: 400 })
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  // RLS ensures telecaller can only update their own contacts; we add an extra
  // explicit assigned_to filter as belt-and-suspenders.
  const { data, error } = await supabase
    .from('linkedin_contacts')
    .update(update)
    .eq('id', id)
    .eq('assigned_to', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity (best-effort — don't fail the request if this errors)
  try {
    let action: string | null = null
    let detail: string | null = null

    if (body.status === 'request_sent') {
      action = 'status_changed'; detail = 'Marked as Request Sent'
    } else if (body.status === 'queued') {
      action = 'status_changed'; detail = 'Marked as Pending (undone)'
    } else {
      const fieldKeys = Object.keys(update)
      if (fieldKeys.length === 1 && fieldKeys[0] === 'notes') {
        action = 'note_added'; detail = 'Notes updated'
      } else if (fieldKeys.length > 0) {
        action = 'fields_updated'
        detail = `Updated: ${fieldKeys.join(', ')}`
      }
    }

    if (action) {
      await supabase.from('linkedin_contact_activity').insert({
        contact_id: id,
        user_id: user.id,
        action,
        detail,
      })
    }
  } catch { /* swallow */ }

  return NextResponse.json({ ok: true, contact: data })
}

// DELETE /api/telecaller/linkedin/contacts/[id] — delete own contact
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error: dbErr } = await supabase
    .from('linkedin_contacts')
    .delete()
    .eq('id', id)
    .eq('assigned_to', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
