import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/telecaller/contacts
// Query: ?page=1&pageSize=50&search=&status=&pipeline_status=&list_id=
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 200)
  const search = searchParams.get('search')?.trim() ?? ''
  const status = searchParams.get('status') ?? ''
  const pipelineStatus = searchParams.get('pipeline_status') ?? ''

  let query = supabase
    .from('linkedin_contacts')
    .select('*', { count: 'exact' })
    .eq('assigned_to', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`
    )
  }
  if (status) query = query.eq('status', status)
  if (pipelineStatus) query = query.eq('pipeline_status', pipelineStatus)

  // List filter
  const listId = searchParams.get('list_id') ?? ''
  if (listId === 'none') {
    const { data: inLists } = await supabase.from('linkedin_list_contacts').select('contact_id')
    const ids = (inLists ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length > 0) query = query.not('id', 'in', `(${ids.join(',')})`)
  } else if (listId) {
    const { data: members } = await supabase.from('linkedin_list_contacts').select('contact_id').eq('list_id', listId)
    const ids = (members ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length === 0) return NextResponse.json({ contacts: [], total: 0, page, pageSize, stats: { totalAssigned: 0, totalSent: 0, totalPending: 0 }, pipeline: {} })
    query = query.in('id', ids)
  }

  const { data: contacts, count } = await query

  // Aggregate stats (unfiltered full picture)
  const { data: allOwn } = await supabase
    .from('linkedin_contacts')
    .select('status, pipeline_status')
    .eq('assigned_to', user.id)

  const totalAssigned = allOwn?.length ?? 0
  const totalSent = allOwn?.filter(c => c.status === 'request_sent').length ?? 0
  const totalPending = totalAssigned - totalSent

  const pipeline: Record<string, number> = { new: 0, contacted: 0, interested: 0, won: 0, lost: 0 }
  for (const c of (allOwn ?? [])) {
    const s = c.pipeline_status ?? 'new'
    if (s in pipeline) pipeline[s]++
  }

  return NextResponse.json({
    contacts: contacts ?? [],
    total: count ?? 0,
    page,
    pageSize,
    stats: { totalAssigned, totalSent, totalPending },
    pipeline,
  })
}

// POST /api/telecaller/contacts — manually add a contact
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  if (!body.first_name || typeof body.first_name !== 'string' || !body.first_name.trim()) {
    return NextResponse.json({ error: 'First name is required.' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('linkedin_contacts')
    .insert({
      first_name: (body.first_name as string).trim(),
      last_name: (body.last_name as string | null)?.trim() || null,
      email: (body.email as string | null)?.trim() || null,
      phone: (body.phone as string | null)?.trim() || null,
      company_name: (body.company_name as string | null)?.trim() || null,
      job_title: (body.job_title as string | null)?.trim() || null,
      linkedin_url: (body.linkedin_url as string | null)?.trim() || null,
      lead_source: (body.lead_source as string | null)?.trim() || null,
      city: (body.city as string | null)?.trim() || null,
      state: (body.state as string | null)?.trim() || null,
      country: (body.country as string | null)?.trim() || null,
      notes: (body.notes as string | null)?.trim() || null,
      pipeline_status: (body.pipeline_status as string) || 'new',
      status: 'queued',
      assigned_to: user.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, contact: data })
}

// DELETE /api/telecaller/contacts — bulk delete own contacts
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contactIds } = await req.json() as { contactIds: string[] }
  if (!contactIds?.length) return NextResponse.json({ error: 'No contacts specified.' }, { status: 400 })

  const { error: dbErr } = await supabase
    .from('linkedin_contacts')
    .delete()
    .in('id', contactIds)
    .eq('assigned_to', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: contactIds.length })
}
