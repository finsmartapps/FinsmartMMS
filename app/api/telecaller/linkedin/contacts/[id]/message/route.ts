import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Variable substitution helper ─────────────────────────────────────────────
function substitute(body: string, vars: Record<string, string>): string {
  return body
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? '')
    .replace(/\s+/g, ' ')   // collapse extra whitespace from missing fields
    .trim()
}

interface Contact {
  first_name: string
  last_name: string | null
  company_name: string | null
  job_title: string | null
  city: string | null
  country: string | null
  lead_source: string | null
}

function buildVars(c: Contact): Record<string, string> {
  return {
    first_name: c.first_name ?? '',
    last_name: c.last_name ?? '',
    full_name: [c.first_name, c.last_name].filter(Boolean).join(' '),
    company: c.company_name ?? '',
    job_title: c.job_title ?? '',
    city: c.city ?? '',
    country: c.country ?? '',
    lead_source: c.lead_source ?? '',
  }
}

// POST /api/telecaller/linkedin/contacts/[id]/message
// Body (optional): { exclude_template_id?: string }  → cycle to a different one
// Returns: { message, templateId, templateName, totalAvailable }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { exclude_template_id } = await req.json().catch(() => ({} as { exclude_template_id?: string }))

  // Fetch the contact (RLS ensures the telecaller can only read their own)
  const { data: contact } = await supabase
    .from('linkedin_contacts')
    .select('first_name, last_name, company_name, job_title, city, country, lead_source')
    .eq('id', id)
    .eq('assigned_to', user.id)
    .single<Contact>()

  if (!contact) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })

  // Fetch all active templates
  const { data: templates } = await supabase
    .from('linkedin_message_templates')
    .select('id, name, body')
    .eq('is_active', true)

  if (!templates || templates.length === 0) {
    return NextResponse.json({
      error: "Your manager hasn't set up any message templates yet. Ask them to add some in Manager → LinkedIn → Templates.",
    }, { status: 404 })
  }

  // Pick one at random, excluding the previous one if asked (so "Try another" cycles)
  const pool = templates.length > 1 && exclude_template_id
    ? templates.filter((t: { id: string }) => t.id !== exclude_template_id)
    : templates

  const picked = pool[Math.floor(Math.random() * pool.length)]
  const vars = buildVars(contact)
  const message = substitute(picked.body, vars)

  // Cache on the contact
  await supabase
    .from('linkedin_contacts')
    .update({ generated_message: message })
    .eq('id', id)
    .eq('assigned_to', user.id)

  // Log activity (best-effort)
  try {
    await supabase.from('linkedin_contact_activity').insert({
      contact_id: id,
      user_id: user.id,
      action: 'message_generated',
      detail: `Template: ${picked.name}`,
    })
  } catch { /* swallow */ }

  return NextResponse.json({
    message,
    templateId: picked.id,
    templateName: picked.name,
    totalAvailable: templates.length,
  })
}
