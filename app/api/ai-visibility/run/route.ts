import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runStep } from '@/lib/ai-visibility/steps'

// "Run now" from the AI Visibility page. POST {step, force}. The page calls it repeatedly
// until {done:true}. Signed-in users with the Marketing module only.

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('has_marketing').eq('id', user.id).single()
  if (!profile?.has_marketing) return NextResponse.json({ error: 'Marketing access needed' }, { status: 403 })

  const { step, force } = await req.json().catch(() => ({})) as { step?: string; force?: boolean }
  try {
    const db = await createAdminClient()
    return NextResponse.json(await runStep(db, step ?? '', !!force))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 500) }, { status: 500 })
  }
}
