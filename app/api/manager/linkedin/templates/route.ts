import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'manager') return { supabase, user, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase, user, error: null }
}

// GET /api/manager/linkedin/templates
export async function GET() {
  const { supabase, error } = await requireManager()
  if (error) return error

  const { data } = await supabase
    .from('linkedin_message_templates')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ templates: data ?? [] })
}

// POST /api/manager/linkedin/templates — create
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await requireManager()
  if (error) return error

  const body = await req.json()
  const name = body.name?.trim()
  const tplBody = body.body?.trim()
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!tplBody) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })

  const { data, error: e } = await supabase
    .from('linkedin_message_templates')
    .insert({ name, body: tplBody, created_by: user!.id })
    .select()
    .single()

  if (e) return NextResponse.json({ error: e.message }, { status: 500 })
  return NextResponse.json({ template: data })
}
