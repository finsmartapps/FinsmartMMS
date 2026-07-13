import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'manager' && profile?.role !== 'admin' && profile?.role !== 'manager') return { user: null, supabase: null }
  return { user, supabase }
}

export async function GET() {
  const { user, supabase } = await requireManager()
  if (!user || !supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: permissions, error } = await supabase
    .from('role_permissions')
    .select('role, module, enabled')
    .order('role')
    .order('module')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permissions })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await requireManager()
  if (!user || !supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role, module: mod, enabled } = await req.json()

  if (!role || !mod) {
    return NextResponse.json({ error: 'role and module are required.' }, { status: 400 })
  }
  if (!['manager', 'telecaller'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('role_permissions')
    .upsert(
      { role, module: mod, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'role,module' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
