import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, has_marketing')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && !profile.has_marketing)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { title, type, description, post_copy, linkedin_url, points, deadline } = body

  if (!title?.trim() || !type) {
    return NextResponse.json({ error: 'Title and type are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('advocacy_missions')
    .insert({
      title, type, description, post_copy, linkedin_url, points,
      deadline: deadline || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mission: data })
}
