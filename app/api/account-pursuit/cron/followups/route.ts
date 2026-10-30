import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { scheduleFollowups } from '@/lib/agents/followups'
import { llmConfigured } from '@/lib/agents/llm'

// Follow-up scheduler: writes touch 2 / touch 3 drafts into the approval queue for people who have not replied.
// Never sends. Called by GitHub Actions (.github/workflows/abm-send.yml). FAILS CLOSED without CRON_SECRET.

export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!llmConfigured()) return NextResponse.json({ created: [], markedCold: 0, skipped: 0, note: 'no AI provider configured' })
  const db = await createAdminClient()
  return NextResponse.json(await scheduleFollowups(db, { max: 2 }))
}

export const GET = run
export const POST = run
