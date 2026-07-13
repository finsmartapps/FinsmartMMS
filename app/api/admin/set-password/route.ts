import { NextResponse } from 'next/server'
import { createClient, createAuthAdminClient } from '@/lib/supabase/server'

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

  const admin = createAuthAdminClient()
  const { data: { users }, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

  const target = users.find(u => u.email === email)
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  const { error: updateError } = await admin.auth.admin.updateUserById(target.id, { password })
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
