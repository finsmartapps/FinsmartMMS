import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: followups, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('user_id', user.id)
    .order('follow_up_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followups })
}

// Find or create a contact for the telecaller, keeping fields in sync
async function upsertContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fields: { first_name: string; last_name: string; company_name?: string | null; phone?: string | null; email?: string | null },
  pipeline_status: 'contacted' | 'interested' = 'contacted',
): Promise<string | null> {
  const { first_name, last_name, company_name, phone, email } = fields
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
    pipeline_status,
  }

  if (contactId) {
    // Sync fields on the existing contact
    await supabase.from('linkedin_contacts').update(contactFields).eq('id', contactId)
  } else {
    // Create new contact
    const { data } = await supabase.from('linkedin_contacts')
      .insert({ ...contactFields, assigned_to: userId, created_by: userId, status: 'queued' })
      .select('id').single()
    contactId = data?.id ?? null
  }

  return contactId
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { first_name, last_name, company_name, phone, email, follow_up_date, notes } = body

  if (!first_name?.trim() || !last_name?.trim() || !follow_up_date) {
    return NextResponse.json({ error: 'First name, last name, and date are required.' }, { status: 400 })
  }

  // Find or create a contact
  const contactId = await upsertContact(supabase, user.id, { first_name, last_name, company_name, phone, email })

  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      user_id: user.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      company_name: company_name?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      follow_up_date,
      notes: notes?.trim() || null,
      status: 'pending',
      contact_id: contactId,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followup: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  // Status-only toggle (circle button)
  if (body.status && Object.keys(body).length === 2) {
    const { error } = await supabase
      .from('follow_ups')
      .update({ status: body.status })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Full edit
  const { first_name, last_name, company_name, phone, email, follow_up_date, notes } = body
  if (!first_name?.trim() || !last_name?.trim() || !follow_up_date) {
    return NextResponse.json({ error: 'First name, last name, and date are required.' }, { status: 400 })
  }

  // Sync contact (find or create) and get contact_id
  const contactId = await upsertContact(supabase, user.id, { first_name, last_name, company_name, phone, email })

  const { error } = await supabase
    .from('follow_ups')
    .update({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      company_name: company_name?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      follow_up_date,
      notes: notes?.trim() || null,
      contact_id: contactId,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  const { error } = await supabase
    .from('follow_ups')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
