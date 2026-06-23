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
  const db = await createAdminClient()         // service role — bypasses RLS for DB queries
  const authAdmin = createAuthAdminClient()    // standard client — exposes auth.admin.*
  return { user, db, authAdmin }
}

export async function GET() {
  const { user, db } = await requireAdmin()
  if (!user || !db) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: users, error } = await db
    .from('profiles')
    .select('id, name, email, role, is_active, created_at')
    .order('role')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const { user, db, authAdmin } = await requireAdmin()
  if (!user || !db || !authAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role } = await req.json()

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }
  if (!['admin', 'manager', 'telecaller'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  }

  const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim(), role },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { error: profileError } = await db
    .from('profiles')
    .insert({ id: authData.user.id, name: name.trim(), email: email.trim(), role })

  if (profileError) {
    await authAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
