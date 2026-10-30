import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkReplies } from '@/lib/agents/reply-watcher'

// "Check for replies now" button. Any signed-in Account Pursuit user may trigger a mailbox check.

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: prof } = await supabase.from('profiles').select('has_account_pursuit, role').eq('id', user.id).single()
  if (!prof?.has_account_pursuit && prof?.role !== 'admin' && prof?.role !== 'manager') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  const db = await createAdminClient()
  return NextResponse.json(await checkReplies(db))
}
