import { NextResponse } from 'next/server'
import { createClient, createAdminClient, createAuthAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  // Verify caller is authenticated
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, password } = await req.json()
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  // Look up the target user's ID from the profiles table
  const db = await createAdminClient()
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found in profiles.' }, { status: 404 })
  }

  // Update the auth user's password using the service role client
  const authAdmin = createAuthAdminClient()
  const { error: updateError } = await authAdmin.auth.admin.updateUserById(profile.id, { password })
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
