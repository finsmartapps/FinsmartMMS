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

// GET /api/manager/linkedin/contacts
// Query: ?page=1&search=&status=&assigned_to=&pageSize=50
// Returns contacts list + telecaller list + per-telecaller breakdown + totals
export async function GET(req: NextRequest) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 200)
  const search = searchParams.get('search')?.trim() ?? ''
  const status = searchParams.get('status') ?? ''
  const assignedTo = searchParams.get('assigned_to') ?? ''

  // Telecaller list (for filter + breakdown labels)
  const { data: telecallers } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'telecaller')
    .eq('is_active', true)
    .order('name')

  // Build the filtered contact query
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
  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  // List filter: '' = all, 'none' = no list, '<uuid>' = specific list
  const listId = searchParams.get('list_id') ?? ''
  if (listId === 'none') {
    const { data: inLists } = await supabase.from('linkedin_list_contacts').select('contact_id')
    const ids = (inLists ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length > 0) query = query.not('id', 'in', `(${ids.join(',')})`)
  } else if (listId) {
    const { data: members } = await supabase.from('linkedin_list_contacts').select('contact_id').eq('list_id', listId)
    const ids = (members ?? []).map((r: { contact_id: string }) => r.contact_id)
    if (ids.length === 0) return NextResponse.json({ contacts: [], total: 0, page, pageSize, telecallers: [], breakdown: [], totals: { totalAll: 0, totalSent: 0, totalPending: 0 } })
    query = query.in('id', ids)
  }

  const { data: contacts, count } = await query

  // Per-telecaller breakdown (unfiltered totals — always full picture)
  const { data: breakdownRaw } = await supabase
    .from('linkedin_contacts')
    .select('assigned_to, status')

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

  // Totals (across all contacts, no filters)
  const totalAll = (breakdownRaw ?? []).length
  const totalSent = (breakdownRaw ?? []).filter((c: { status: string }) => c.status === 'request_sent').length
  const totalPending = totalAll - totalSent

  return NextResponse.json({
    contacts: contacts ?? [],
    total: count ?? 0,
    page,
    pageSize,
    telecallers: telecallers ?? [],
    breakdown,
    totals: { totalAll, totalSent, totalPending },
  })
}

// DELETE /api/manager/linkedin/contacts — bulk delete contacts
export async function DELETE(req: NextRequest) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { contactIds } = await req.json() as { contactIds: string[] }
  if (!contactIds?.length) return NextResponse.json({ error: 'No contacts specified.' }, { status: 400 })

  const { error: dbErr } = await supabase.from('linkedin_contacts').delete().in('id', contactIds)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: contactIds.length })
}
