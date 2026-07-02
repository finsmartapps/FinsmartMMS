import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mission_id } = await req.json()
  if (!mission_id) return NextResponse.json({ error: 'mission_id required' }, { status: 400 })

  const { error } = await supabase
    .from('advocacy_completions')
    .upsert(
      { mission_id, user_id: user.id },
      { onConflict: 'mission_id,user_id', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
