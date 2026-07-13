import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { action, reviewer_notes } = body

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Action must be "approve" or "reject"' }, { status: 400 })
  }

  if (action === 'reject' && !reviewer_notes?.trim()) {
    return NextResponse.json({ error: 'Reviewer notes are required when rejecting' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ms_social_posts')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewer_notes: reviewer_notes?.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
