import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/telecaller/linkedin/contacts
// Query: ?page=1&pageSize=50&search=&status=
// Returns ALL contacts assigned to the current telecaller (paginated + searchable).
// RLS auto-scopes to assigned_to = current user.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 200)
  const search = searchParams.get('search')?.trim() ?? ''
  const status = searchParams.get('status') ?? ''

  // Filtered, paginated list
  let query = supabase
    .from('linkedin_contacts')
    .select('*', { count: 'exact' })
    .eq('assigned_to', user.id)
    .order('request_sent_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`
    )
  }
  if (status) query = query.eq('status', status)

  // List filter: '' = all, 'none' = no list, '<uuid>' = specific list
  const listId = searchParams.get('list_id') ?? ''
  if (listId === 'none') {
    const { data: inLists } = await supabase.from('linkedin_list_contacts').select('contact_id')
    const ids = (inLists ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length > 0) query = query.not('id', 'in', `(${ids.join(',')})`)
  } else if (listId) {
    const { data: members } = await supabase.from('linkedin_list_contacts').select('contact_id').eq('list_id', listId)
    const ids = (members ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length === 0) return NextResponse.json({ contacts: [], total: 0, page, pageSize, stats: { totalAssigned: 0, totalSent: 0, totalPending: 0 } })
    query = query.in('id', ids)
  }

  const { data: contacts, count } = await query

  // Aggregate stats (unfiltered, full picture)
  const { count: totalAssigned } = await supabase
    .from('linkedin_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)

  const { count: totalSent } = await supabase
    .from('linkedin_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)
    .eq('status', 'request_sent')

  const { count: totalPending } = await supabase
    .from('linkedin_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)
    .eq('status', 'queued')

  return NextResponse.json({
    contacts: contacts ?? [],
    total: count ?? 0,
    page,
    pageSize,
    stats: {
      totalAssigned: totalAssigned ?? 0,
      totalSent: totalSent ?? 0,
      totalPending: totalPending ?? 0,
    },
  })
}

// DELETE /api/telecaller/linkedin/contacts — bulk delete own contacts
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contactIds } = await req.json() as { contactIds: string[] }
  if (!contactIds?.length) return NextResponse.json({ error: 'No contacts specified.' }, { status: 400 })

  // RLS + explicit assigned_to filter ensures telecaller can only delete their own contacts
  const { error: dbErr } = await supabase
    .from('linkedin_contacts')
    .delete()
    .in('id', contactIds)
    .eq('assigned_to', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: contactIds.length })
}
