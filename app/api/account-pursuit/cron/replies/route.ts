import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkReplies } from '@/lib/agents/reply-watcher'

// Reply Watcher cron: reads the outreach mailbox and processes replies / bounces.
// Called every ~15 min by GitHub Actions (.github/workflows/abm-send.yml). FAILS CLOSED without CRON_SECRET.

export const maxDuration = 60
export const runtime = 'nodejs'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = await createAdminClient()
  return NextResponse.json(await checkReplies(db))
}

export const GET = run
export const POST = run
