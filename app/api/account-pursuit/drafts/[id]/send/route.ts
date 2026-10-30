import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendApprovedDrafts } from '@/lib/agents/sender'
import { sendPlain, mailerConfigured } from '@/lib/agents/mailer'

// POST { mode: 'now' | 'test' }
//   test: emails the draft to YOUR OWN address (subject prefixed [TEST]) so you can check inbox placement.
//   now : sends an approved draft immediately (still respects the daily cap, kill switch and one-per-firm rule).

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { mode } = await req.json().catch(() => ({ mode: 'now' }))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS: only drafts the user may see
  const { data: draft } = await supabase.from('abm_drafts').select('*').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (!mailerConfigured()) {
    return NextResponse.json({ error: 'Outreach mailbox is not configured yet (ABM_SMTP_HOST / ABM_SMTP_USER / ABM_SMTP_PASS).' }, { status: 503 })
  }

  const db = await createAdminClient()
  const { data: settings } = await db.from('abm_agent_settings').select('*').eq('id', 1).single()
  if (!settings) return NextResponse.json({ error: 'Agent settings missing. Run the migration.' }, { status: 500 })

  if (mode === 'test') {
    if (!user.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 })
    try {
      await sendPlain({ to: user.email, subject: `[TEST] ${draft.subject ?? ''}`.trim(), text: draft.body, fromName: settings.sender_name })
      return NextResponse.json({ ok: true, message: `Test sent to ${user.email}. Check the inbox (and spam) to see where it lands.` })
    } catch (e) {
      return NextResponse.json({ error: `SMTP error: ${(e as Error).message.slice(0, 200)}` }, { status: 502 })
    }
  }

  if (draft.status !== 'approved') return NextResponse.json({ error: 'Approve the draft before sending.' }, { status: 400 })
  const run = await sendApprovedDrafts(db, { draftId: id, limit: 1, ignoreWindow: true })
  const o = run.outcomes[0]
  if (!o) return NextResponse.json({ error: run.note }, { status: 409 })
  if (o.status === 'sent') return NextResponse.json({ ok: true, message: 'Sent.' })
  return NextResponse.json({ error: o.reason ?? 'Not sent.' }, { status: 409 })
}
