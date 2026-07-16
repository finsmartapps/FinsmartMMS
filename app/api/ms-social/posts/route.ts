import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, has_ms_social')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ms_social) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isManagerOrAdmin = profile.role === 'manager' || profile.role === 'admin'

  let query = supabase
    .from('ms_social_posts')
    .select('*, creator:profiles!created_by(name)')
    .order('created_at', { ascending: false })

  if (!isManagerOrAdmin) {
    query = query.eq('created_by', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (data ?? []).map((post: any) => ({
    ...post,
    creator_name: post.creator?.name ?? null,
    creator: undefined,
  }))

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_ms_social')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ms_social) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { description, image_options, publish_date, platform } = body

  if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  if (!publish_date) return NextResponse.json({ error: 'Publish date is required' }, { status: 400 })

  const cleanOptions = Array.isArray(image_options)
    ? image_options.filter((u: string) => u?.trim())
    : []

  const { data, error } = await supabase
    .from('ms_social_posts')
    .insert({
      description,
      image_url: cleanOptions[0] || null,
      image_options: cleanOptions,
      publish_date,
      platform: platform || 'LinkedIn',
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data }, { status: 201 })
}
