import { NextResponse } from 'next/server'
import { createClient, createAdminClient, createAuthAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return (profile?.role === 'admin' || profile?.role === 'manager') ? user : null
}

export async function POST(req: Request) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password } = await req.json()
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  // Look up the target user's ID from the profiles table
  const db = await createAdminClient()
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id')
    .ilike('email', email.trim())
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found in profiles.' }, { status: 404 })
  }

  const authAdmin = createAuthAdminClient()
  const { error: updateError } = await authAdmin.auth.admin.updateUserById(profile.id, { password })
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
