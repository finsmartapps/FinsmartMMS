import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmailDraft, DraftError } from '@/lib/agents/draft-service'
import { llmConfigured } from '@/lib/agents/llm'

// Strategist → Copywriter → Critic. Saves the result to abm_drafts as "pending_approval"
// (RLS-scoped to the signed-in user). Nothing is sent here.

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: 'No free AI provider is configured yet. Add GEMINI_API_KEY (or GROQ_API_KEY / OPENROUTER_API_KEY) to the environment.' }, { status: 503 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const r = await createEmailDraft(supabase, id, {
      step: Number(body.step) || undefined,
      instructions: (body.instructions || '').toString().slice(0, 400),
      userId: user.id,
    })
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof DraftError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Draft generation failed. Try again.' }, { status: 502 })
  }
}
