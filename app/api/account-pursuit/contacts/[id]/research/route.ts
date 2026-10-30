import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runResearch } from '@/lib/agents/researcher'
import { LlmError, llmConfigured } from '@/lib/agents/llm'

// Researcher agent: reads the firm's own website + recent news headlines (free sources),
// keeps only facts it can quote verbatim from a source, and caches them in abm_research.

export const maxDuration = 60

const FRESH_DAYS = 14

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: 'No free AI provider is configured yet (GEMINI_API_KEY).' }, { status: 503 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const force = body.force === true

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: contact, error } = await supabase.from('abm_contacts').select('*').eq('id', id).single()
  if (error || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  const { data: account } = await supabase.from('abm_accounts').select('*').eq('id', contact.account_id).single()
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  if (!force) {
    const since = new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString()
    const { data: fresh } = await supabase.from('abm_research').select('*')
      .eq('contact_id', id).gte('created_at', since).order('created_at', { ascending: false }).limit(1)
    if (fresh && fresh.length > 0) return NextResponse.json({ research: fresh[0], cached: true })
  }

  try {
    const r = await runResearch(account, contact)
    const { data: row, error: insErr } = await supabase.from('abm_research').insert({
      account_id: account.id, contact_id: contact.id, owner_id: contact.owner_id ?? user.id,
      facts: r.facts, sources: r.sources, status: r.status, note: r.note,
    }).select('*').single()
    if (insErr) return NextResponse.json({ error: `Could not save research: ${insErr.message}` }, { status: 500 })
    return NextResponse.json({ research: row, cached: false })
  } catch (e) {
    const msg = e instanceof LlmError ? e.message : 'Research failed. Try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
