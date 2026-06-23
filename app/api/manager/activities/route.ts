import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function assertManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager') return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  if (!await assertManager(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await assertManager(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  // Get max display_order
  const { data: last } = await supabase
    .from('activities')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await supabase
    .from('activities')
    .insert({ name: name.trim(), description: description ?? null, created_by: user.id, display_order: ((last?.display_order ?? 0) + 1) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  if (!await assertManager(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data })
}
