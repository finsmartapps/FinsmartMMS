import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayIST } from '@/lib/utils'

interface EntryPayload {
  activityId: string
  value: number
  deficitReason: string | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { userId, logDate, entries } = body as {
    userId: string
    logDate: string
    entries: EntryPayload[]
  }

  // Security: telecaller can only submit for themselves
  if (userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate date format and not in the future
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return NextResponse.json({ error: 'Invalid date format.' }, { status: 400 })
  }
  if (logDate > todayIST()) {
    return NextResponse.json({ error: 'Cannot submit logs for future dates.' }, { status: 400 })
  }

  // Check for existing log (for upsert id)
  const { data: existingLog } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .single()

  // Upsert the daily log (allow re-editing any past log)
  const { data: log, error: logError } = await supabase
    .from('daily_logs')
    .upsert(
      {
        id: existingLog?.id,
        user_id: userId,
        log_date: logDate,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,log_date' }
    )
    .select('id')
    .single()

  if (logError || !log) {
    return NextResponse.json({ error: 'Failed to save log.' }, { status: 500 })
  }

  // Upsert all entries
  const entryRows = entries.map((e: EntryPayload) => ({
    log_id: log.id,
    activity_id: e.activityId,
    value: e.value,
    deficit_reason: e.deficitReason,
  }))

  const { error: entriesError } = await supabase
    .from('daily_log_entries')
    .upsert(entryRows, { onConflict: 'log_id,activity_id' })

  if (entriesError) {
    return NextResponse.json({ error: 'Failed to save entries.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, logId: log.id })
}
