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
    .select('role, has_ms_social')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ms_social) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const isManagerOrAdmin = profile.role === 'manager' || profile.role === 'admin'

  const { data: existing } = await supabase
    .from('ms_social_posts')
    .select('created_by, status')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (!isManagerOrAdmin) {
    if (existing.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existing.status !== 'pending' && existing.status !== 'rejected') {
      return NextResponse.json({ error: 'Can only edit pending or rejected posts' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { description, image_options, publish_date, platform } = body

  const updateData: Record<string, unknown> = {}
  if (description !== undefined) updateData.description = description
  if (publish_date !== undefined) updateData.publish_date = publish_date
  if (platform !== undefined) updateData.platform = platform
  if (image_options !== undefined) {
    const clean = Array.isArray(image_options)
      ? image_options.filter((u: string) => u?.trim())
      : []
    updateData.image_options = clean
    updateData.image_url = clean[0] || null
  }

  // Employee resubmitting a rejected post — reset back to pending
  if (!isManagerOrAdmin && existing.status === 'rejected') {
    updateData.status = 'pending'
    updateData.reviewer_notes = null
    updateData.reviewed_by = null
    updateData.reviewed_at = null
    updateData.selected_images = []
  }

  const { data, error } = await supabase
    .from('ms_social_posts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, has_ms_social')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ms_social) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const isManagerOrAdmin = profile.role === 'manager' || profile.role === 'admin'

  const { data: existing } = await supabase
    .from('ms_social_posts')
    .select('created_by, status')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (!isManagerOrAdmin) {
    if (existing.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existing.status !== 'pending' && existing.status !== 'rejected') {
      return NextResponse.json({ error: 'Can only delete pending or rejected posts' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('ms_social_posts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
