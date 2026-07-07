import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient, createAuthAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, db: null, authAdmin: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { user: null, db: null, authAdmin: null }
  const db = await createAdminClient()
  const authAdmin = createAuthAdminClient()
  return { user, db, authAdmin }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, db } = await requireAdmin()
  if (!user || !db) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  const VALID_ROLES = ['admin', 'manager', 'telecaller', 'finance_manager']

  if ('role' in body) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
    }
    updates.role = body.role
  }

  if ('is_active' in body) updates.is_active = Boolean(body.is_active)

  for (const col of ['has_sales','has_marketing','has_expenses','has_warehouse','has_advocacy']) {
    if (col in body) updates[col] = Boolean(body[col])
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
  }

  const { error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authAdmin } = await requireAdmin()
  if (!user || !authAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  if (id === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }

  const { error } = await authAdmin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
