import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Find or create a contact for the telecaller, keeping fields in sync
async function upsertContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fields: { first_name: string; last_name: string; company_name?: string | null; phone?: string | null; email?: string | null; lead_source?: string | null },
): Promise<string | null> {
  const { first_name, last_name, company_name, phone, email, lead_source } = fields
  let contactId: string | null = null

  // Search priority: email → phone → name
  if (email?.trim()) {
    const { data } = await supabase.from('linkedin_contacts').select('id').eq('assigned_to', userId).eq('email', email.trim()).maybeSingle()
    contactId = data?.id ?? null
  }
  if (!contactId && phone?.trim()) {
    const { data } = await supabase.from('linkedin_contacts').select('id').eq('assigned_to', userId).eq('phone', phone.trim()).maybeSingle()
    contactId = data?.id ?? null
  }
  if (!contactId) {
    const { data } = await supabase.from('linkedin_contacts').select('id')
      .eq('assigned_to', userId).eq('first_name', first_name.trim()).eq('last_name', last_name.trim()).maybeSingle()
    contactId = data?.id ?? null
  }

  const contactFields = {
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    company_name: company_name?.trim() || null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    lead_source: lead_source?.trim() || null,
    pipeline_status: 'interested' as const,
  }

  if (contactId) {
    await supabase.from('linkedin_contacts').update(contactFields).eq('id', contactId)
  } else {
    const { data } = await supabase.from('linkedin_contacts')
      .insert({ ...contactFields, assigned_to: userId, created_by: userId, status: 'queued' })
      .select('id').single()
    contactId = data?.id ?? null
  }

  return contactId
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', user.id)
    .order('meeting_date', { ascending: false })
    .order('meeting_time', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meetings })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { first_name, last_name, company_name, company_size, meeting_date, meeting_time, timezone, lead_source, notes, phone, email } = body

  if (!first_name?.trim() || !last_name?.trim() || !company_name?.trim() || !meeting_date || !meeting_time || !timezone) {
    return NextResponse.json({ error: 'Required fields missing.' }, { status: 400 })
  }

  // Find or create contact (meeting = 'interested' stage)
  const contactId = await upsertContact(supabase, user.id, { first_name, last_name, company_name, phone, email, lead_source })

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      company_name: company_name.trim(),
      company_size: company_size || null,
      meeting_date,
      meeting_time,
      timezone,
      lead_source: lead_source || null,
      notes: notes?.trim() || null,
      outcome: null,
      contact_id: contactId,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meeting: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, first_name, last_name, company_name, company_size, meeting_date, meeting_time, timezone, lead_source, notes, outcome, result, phone, email } = body

  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  // Allow outcome-only or result-only PATCH (no required fields needed)
  const isQuickPatch = (outcome !== undefined || result !== undefined) && !first_name && !last_name && !company_name && !meeting_date && !meeting_time && !timezone

  if (!isQuickPatch && (!first_name?.trim() || !last_name?.trim() || !company_name?.trim() || !meeting_date || !meeting_time || !timezone)) {
    return NextResponse.json({ error: 'Required fields missing.' }, { status: 400 })
  }

  const VALID_OUTCOMES = ['completed', 'cancelled', 'rescheduled', 'closed_won', null]
  if (outcome !== undefined && !VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome value.' }, { status: 400 })
  }

  const VALID_RESULTS = ['converted_opportunity', 'future_followup', 'lost', null]
  if (result !== undefined && !VALID_RESULTS.includes(result)) {
    return NextResponse.json({ error: 'Invalid result value.' }, { status: 400 })
  }

  let updatePayload: Record<string, unknown>

  if (isQuickPatch) {
    updatePayload = {
      ...(outcome !== undefined ? { outcome: outcome ?? null } : {}),
      ...(result !== undefined ? { result: result ?? null } : {}),
    }
  } else {
    // Sync contact fields and get contact_id
    const contactId = await upsertContact(supabase, user.id, { first_name, last_name, company_name, phone, email, lead_source })

    updatePayload = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      company_name: company_name.trim(),
      company_size: company_size || null,
      meeting_date,
      meeting_time,
      timezone,
      lead_source: lead_source || null,
      notes: notes?.trim() || null,
      contact_id: contactId,
      ...(outcome !== undefined ? { outcome: outcome ?? null } : {}),
    }
  }

  const { data, error } = await supabase
    .from('meetings')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Meeting not found or access denied.' }, { status: 404 })
  return NextResponse.json({ meeting: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
