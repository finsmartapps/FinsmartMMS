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

// GET /api/manager/contacts
// Query: ?page=1&search=&status=&pipeline_status=&assigned_to=&list_id=&pageSize=50
export async function GET(req: NextRequest) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 200)
  const search = searchParams.get('search')?.trim() ?? ''
  const status = searchParams.get('status') ?? ''
  const pipelineStatus = searchParams.get('pipeline_status') ?? ''
  const assignedTo = searchParams.get('assigned_to') ?? ''

  // Telecaller list
  const { data: telecallers } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'telecaller')
    .eq('is_active', true)
    .order('name')

  // Build filtered contact query
  let query = supabase
    .from('linkedin_contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`
    )
  }
  if (status) query = query.eq('status', status)
  if (pipelineStatus) query = query.eq('pipeline_status', pipelineStatus)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  // List filter
  const listId = searchParams.get('list_id') ?? ''
  if (listId === 'none') {
    const { data: inLists } = await supabase.from('linkedin_list_contacts').select('contact_id')
    const ids = (inLists ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length > 0) query = query.not('id', 'in', `(${ids.join(',')})`)
  } else if (listId) {
    const { data: members } = await supabase.from('linkedin_list_contacts').select('contact_id').eq('list_id', listId)
    const ids = (members ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length === 0) return NextResponse.json({ contacts: [], total: 0, page, pageSize, telecallers: [], breakdown: [], totals: { totalAll: 0, totalSent: 0, totalPending: 0 }, pipeline: {} })
    query = query.in('id', ids)
  }

  const { data: contacts, count } = await query

  // Full breakdown data (unfiltered)
  const { data: breakdownRaw } = await supabase
    .from('linkedin_contacts')
    .select('assigned_to, status, pipeline_status')

  // Per-telecaller breakdown
  const breakdownMap: Record<string, { name: string; total: number; sent: number; pending: number }> = {}
  for (const u of (telecallers ?? [])) {
    breakdownMap[u.id] = { name: u.name, total: 0, sent: 0, pending: 0 }
  }
  for (const r of (breakdownRaw ?? [])) {
    if (!r.assigned_to) continue
    if (!breakdownMap[r.assigned_to]) breakdownMap[r.assigned_to] = { name: 'Unknown', total: 0, sent: 0, pending: 0 }
    breakdownMap[r.assigned_to].total++
    if (r.status === 'request_sent') breakdownMap[r.assigned_to].sent++
    else breakdownMap[r.assigned_to].pending++
  }
  const breakdown = Object.entries(breakdownMap)
    .map(([id, v]) => ({ id, ...v }))
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)

  // Totals
  const allContacts = breakdownRaw ?? []
  const totalAll = allContacts.length
  const totalSent = allContacts.filter((c: { status: string }) => c.status === 'request_sent').length
  const totalPending = totalAll - totalSent

  // Pipeline stage breakdown
  const pipeline: Record<string, number> = { new: 0, contacted: 0, interested: 0, won: 0, lost: 0 }
  for (const c of allContacts) {
    const s = (c as { pipeline_status: string }).pipeline_status ?? 'new'
    if (s in pipeline) pipeline[s]++
  }

  return NextResponse.json({
    contacts: contacts ?? [],
    total: count ?? 0,
    page,
    pageSize,
    telecallers: telecallers ?? [],
    breakdown,
    totals: { totalAll, totalSent, totalPending },
    pipeline,
  })
}

// POST /api/manager/contacts — create a contact manually
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await requireManager()
  if (error) return error

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
      assigned_to: (body.assigned_to as string | null) || null,
      pipeline_status: (body.pipeline_status as string) || 'new',
      status: 'queued',
      created_by: user!.id,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, contact: data })
}

// DELETE /api/manager/contacts — bulk delete
export async function DELETE(req: NextRequest) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { contactIds } = await req.json() as { contactIds: string[] }
  if (!contactIds?.length) return NextResponse.json({ error: 'No contacts specified.' }, { status: 400 })

  const { error: dbErr } = await supabase.from('linkedin_contacts').delete().in('id', contactIds)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: contactIds.length })
}
