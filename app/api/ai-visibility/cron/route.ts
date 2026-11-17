import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runStep } from '@/lib/ai-visibility/steps'

// Weekly AI Visibility job, called step by step by .github/workflows/ai-visibility.yml:
//   /api/ai-visibility/cron?step=ask|sites|readiness|gsc|suggest[&force=1]
// See lib/ai-visibility/steps.ts. Fails closed without CRON_SECRET.

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  try {
    const db = await createAdminClient()
    return NextResponse.json(await runStep(db, url.searchParams.get('step') ?? '', url.searchParams.get('force') === '1'))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 500) }, { status: 500 })
  }
}
