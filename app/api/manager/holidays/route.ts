import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function assertManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager' && profile?.role !== 'admin' && profile?.role !== 'manager') return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  if (!await assertManager(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: holidays, error } = await supabase
    .from('holidays')
    .select('*')
    .order('holiday_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holidays })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await assertManager(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { holiday_date, label } = await req.json()
  if (!holiday_date || !label?.trim()) {
    return NextResponse.json({ error: 'Date and label are required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('holidays')
    .insert({ holiday_date, label: label.trim(), created_by: user.id })
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'A holiday already exists on this date.' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ holiday: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  if (!await assertManager(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  const { error } = await supabase.from('holidays').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
