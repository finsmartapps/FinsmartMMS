import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayIST } from '@/lib/utils'

async function assertManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager') return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  if (!await assertManager(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: users }, { data: activities }, { data: targets }] = await Promise.all([
    supabase.from('profiles').select('id, name, email').eq('role', 'telecaller').eq('is_active', true).order('name'),
    supabase.from('activities').select('id, name, display_order').eq('is_active', true).order('display_order'),
    supabase.from('targets').select('*').order('effective_from', { ascending: false }),
  ])

  return NextResponse.json({ users, activities, targets })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await assertManager(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { targets } = await req.json() as {
    targets: { user_id: string; activity_id: string; min_value: number }[]
  }

  const today = todayIST()

  const rows = targets.map(t => ({
    user_id: t.user_id,
    activity_id: t.activity_id,
    min_value: t.min_value,
    effective_from: today,
    created_by: user.id,
  }))

  const { error } = await supabase
    .from('targets')
    .upsert(rows, { onConflict: 'user_id,activity_id,effective_from' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
