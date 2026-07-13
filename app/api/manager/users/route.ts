import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient, createAuthAdminClient } from '@/lib/supabase/server'

async function assertManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, db: null, authAdmin: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager' && profile?.role !== 'admin' && profile?.role !== 'manager') return { user: null, db: null, authAdmin: null }
  const db = await createAdminClient()
  const authAdmin = createAuthAdminClient()
  return { user, db, authAdmin }
}

// GET — list all profiles with module flags
export async function GET() {
  const { user, db } = await assertManager()
  if (!user || !db) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: users, error } = await db
    .from('profiles')
    .select('id, name, email, role, is_active, has_sales, has_marketing, has_expenses, has_warehouse, has_advocacy, created_at')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users })
}

// POST — create user with module access
export async function POST(req: NextRequest) {
  const { user, db, authAdmin } = await assertManager()
  if (!user || !db || !authAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role, has_sales, has_marketing, has_expenses, has_warehouse, has_advocacy } = await req.json()

  if (!name?.trim() || !email?.trim() || !password?.trim())
    return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 400 })
  if (password.length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  if (!has_sales && !has_marketing && !has_expenses && !has_warehouse && !has_advocacy)
    return NextResponse.json({ error: 'Select at least one module.' }, { status: 400 })
  if (!['manager', 'telecaller', 'warehouse_user', 'employee'].includes(role))
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })

  const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim(), role },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { error: profileError } = await db.from('profiles').insert({
    id: authData.user.id,
    name: name.trim(),
    email: email.trim(),
    role,
    has_sales: Boolean(has_sales),
    has_marketing: Boolean(has_marketing),
    has_expenses: Boolean(has_expenses),
    has_warehouse: Boolean(has_warehouse),
    has_advocacy: Boolean(has_advocacy),
  })

  if (profileError) {
    await authAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// PATCH — update role, is_active, and/or module flags
export async function PATCH(req: NextRequest) {
  const { user, db } = await assertManager()
  if (!user || !db) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  if ('is_active' in fields) updates.is_active = Boolean(fields.is_active)

  if ('role' in fields) {
    if (fields.role !== null && !['manager', 'telecaller', 'warehouse_user', 'employee'].includes(fields.role))
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
    updates.role = fields.role ?? null
  }

  for (const key of ['has_sales', 'has_marketing', 'has_expenses', 'has_warehouse', 'has_advocacy'] as const) {
    if (key in fields) updates[key] = Boolean(fields[key])
  }

  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  const { error } = await db.from('profiles').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — remove user
export async function DELETE(req: NextRequest) {
  const { user, db, authAdmin } = await assertManager()
  if (!user || !db || !authAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })
  if (id === user.id) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  const { error } = await authAdmin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
