import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayIST } from '@/lib/utils'

// GET /api/telecaller/linkedin/today
// Auto-queues up to the configurable daily quota for today, then returns today's full list.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Read configurable daily quota from settings (default 15)
  const { data: quotaSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'linkedin_daily_quota')
    .single()
  const DAILY_LIMIT = parseInt(quotaSetting?.value ?? '15', 10)

  const today = todayIST()

  // How many already queued for today?
  const { count: alreadyQueued } = await supabase
    .from('linkedin_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)
    .eq('queue_date', today)

  const remaining = DAILY_LIMIT - (alreadyQueued ?? 0)

  // Pull next N from unqueued pool (oldest first = upload order)
  if (remaining > 0) {
    const { data: nextContacts } = await supabase
      .from('linkedin_contacts')
      .select('id')
      .eq('assigned_to', user.id)
      .eq('status', 'queued')
      .is('queue_date', null)
      .order('created_at', { ascending: true })
      .limit(remaining)

    if (nextContacts && nextContacts.length > 0) {
      const ids = nextContacts.map((c: { id: string }) => c.id)
      await supabase
        .from('linkedin_contacts')
        .update({ queue_date: today })
        .in('id', ids)
    }
  }

  // Return today's full list (both sent and pending)
  const { data: contacts } = await supabase
    .from('linkedin_contacts')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('queue_date', today)
    .order('status', { ascending: true })   // pending first, sent at bottom
    .order('created_at', { ascending: true })

  // Pool stats for the telecaller
  const { count: totalAssigned } = await supabase
    .from('linkedin_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)

  const { count: totalSent } = await supabase
    .from('linkedin_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)
    .eq('status', 'request_sent')

  const { count: totalPending } = await supabase
    .from('linkedin_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)
    .eq('status', 'queued')

  return NextResponse.json({
    contacts: contacts ?? [],
    today,
    stats: {
      totalAssigned: totalAssigned ?? 0,
      totalSent: totalSent ?? 0,
      totalPending: totalPending ?? 0,
      todayTotal: (contacts ?? []).length,
      todaySent: (contacts ?? []).filter((c: { status: string }) => c.status === 'request_sent').length,
    },
  })
}
