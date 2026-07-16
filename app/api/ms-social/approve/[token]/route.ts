import { NextRequest, NextResponse } from 'next/server'
import { createAuthAdminClient } from '@/lib/supabase/server'

async function getPost(token: string) {
  const supabase = createAuthAdminClient()
  const { data, error } = await supabase
    .from('ms_social_posts')
    .select('*, creator:profiles!created_by(name)')
    .eq('approval_token', token)
    .single()
  if (error || !data) return null
  return { ...data, creator_name: data.creator?.name ?? null, creator: undefined }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const post = await getPost(token)
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  return NextResponse.json({ post })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createAuthAdminClient()

  const { data: existing } = await supabase
    .from('ms_social_posts')
    .select('id, status')
    .eq('approval_token', token)
    .single()

  if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const body = await req.json()
  const { action, reviewer_notes, description, image_options, image_url, publish_date, platform, selected_images } = body

  const cleanOptions = Array.isArray(image_options) ? image_options.filter((u: string) => u?.trim()) : undefined
  const cleanSelected = Array.isArray(selected_images) ? selected_images.filter((u: string) => u?.trim()) : []

  let updateData: Record<string, unknown> = {}

  if (action === 'approve') {
    updateData = {
      status: 'approved',
      reviewer_notes: reviewer_notes?.trim() || null,
      reviewed_at: new Date().toISOString(),
      selected_images: cleanSelected,
    }
  } else if (action === 'reject') {
    if (!reviewer_notes?.trim()) {
      return NextResponse.json({ error: 'Notes are required when rejecting' }, { status: 400 })
    }
    updateData = {
      status: 'rejected',
      reviewer_notes: reviewer_notes.trim(),
      reviewed_at: new Date().toISOString(),
    }
  } else if (action === 'edit') {
    if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    if (!publish_date) return NextResponse.json({ error: 'Publish date is required' }, { status: 400 })
    updateData = {
      description,
      image_options: cleanOptions ?? [],
      image_url: cleanOptions?.[0] ?? image_url ?? null,
      publish_date,
      platform: platform || 'LinkedIn',
    }
  } else if (action === 'edit-and-approve') {
    if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    if (!publish_date) return NextResponse.json({ error: 'Publish date is required' }, { status: 400 })
    updateData = {
      description,
      image_options: cleanOptions ?? [],
      image_url: cleanOptions?.[0] ?? image_url ?? null,
      publish_date,
      platform: platform || 'LinkedIn',
      status: 'approved',
      reviewer_notes: null,
      reviewed_at: new Date().toISOString(),
      selected_images: cleanSelected,
    }
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ms_social_posts')
    .update(updateData)
    .eq('id', existing.id)
    .select('*, creator:profiles!created_by(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    post: { ...data, creator_name: data.creator?.name ?? null, creator: undefined }
  })
}
