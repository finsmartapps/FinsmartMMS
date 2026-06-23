import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// GET /api/linkedin/lists — all lists with contact counts (any authenticated user)
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: lists, error } = await supabase
    .from('linkedin_lists')
    .select('id, name, description, created_by, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Contact counts per list
  const { data: counts } = await supabase
    .from('linkedin_list_contacts')
    .select('list_id')

  const countMap: Record<string, number> = {}
  for (const r of (counts ?? [])) {
    countMap[r.list_id] = (countMap[r.list_id] ?? 0) + 1
  }

  const result = (lists ?? []).map(l => ({
    ...l,
    contact_count: countMap[l.id] ?? 0,
  }))

  return NextResponse.json({ lists: result })
}

// POST /api/linkedin/lists — create a new list
export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'List name is required.' }, { status: 400 })

  const { data, error } = await supabase
    .from('linkedin_lists')
    .insert({ name: name.trim(), description: description?.trim() || null, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ list: { ...data, contact_count: 0 } })
}
