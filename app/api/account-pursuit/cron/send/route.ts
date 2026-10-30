import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendApprovedDrafts } from '@/lib/agents/sender'

// Sender cron: delivers a few APPROVED email drafts per run, inside the daily cap and send window.
// Called every ~15 min by GitHub Actions (.github/workflows/abm-send.yml) and once a day by Vercel Cron.
// FAILS CLOSED: if CRON_SECRET is not set, nothing is allowed to trigger sending.

export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true
  return false
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = await createAdminClient()
  const result = await sendApprovedDrafts(db, { limit: 2 })
  return NextResponse.json(result)
}

export const GET = run
export const POST = run
