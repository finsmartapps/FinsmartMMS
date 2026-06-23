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

interface ContactInput {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  company_name?: string | null
  job_title?: string | null
  linkedin_url?: string | null
  lead_source?: string | null
  city?: string | null
  country?: string | null
}

// POST /api/manager/contacts/import
// JSON body: { assigned_to: uuid, contacts: ContactInput[] }
export async function POST(req: NextRequest) {
  const { supabase, error } = await requireManager()
  if (error) return error

  const body = await req.json() as { assigned_to?: string; contacts?: ContactInput[] }
  const { assigned_to, contacts } = body

  if (!assigned_to) return NextResponse.json({ error: 'Please select a telecaller.' }, { status: 400 })
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: 'No contacts to import.' }, { status: 400 })
  }

  const totalRows = contacts.length

  // Only require first_name
  const withFirstName = contacts.filter(c => typeof c.first_name === 'string' && c.first_name.trim())
  const missingFirstName = totalRows - withFirstName.length

  if (withFirstName.length === 0) {
    return NextResponse.json({ error: 'No rows have a First Name. Make sure the column mapped to First Name has values.' }, { status: 400 })
  }

  // Dedupe within file by email
  const seen = new Set<string>()
  const deduped = withFirstName.filter(c => {
    if (!c.email) return true
    const k = c.email.toLowerCase().trim()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const duplicatesInFile = withFirstName.length - deduped.length

  const toInsert = deduped.map(c => ({
    assigned_to,
    first_name: c.first_name!.trim(),
    last_name: c.last_name?.trim() || null,
    email: c.email?.trim() || null,
    phone: c.phone?.trim() || null,
    company_name: c.company_name?.trim() || null,
    job_title: c.job_title?.trim() || null,
    linkedin_url: c.linkedin_url?.trim() || null,
    lead_source: c.lead_source?.trim() || null,
    city: c.city?.trim() || null,
    country: c.country?.trim() || null,
    status: 'queued' as const,
    pipeline_status: 'new' as const,
  }))

  const BATCH = 500
  let inserted = 0

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { data, error: e } = await supabase
      .from('linkedin_contacts')
      .upsert(batch, { onConflict: 'email', ignoreDuplicates: true })
      .select('id')

    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    inserted += data?.length ?? 0
  }

  const duplicatesInDB = toInsert.length - inserted
  const totalSkipped = missingFirstName + duplicatesInFile + duplicatesInDB

  const parts: string[] = []
  if (missingFirstName > 0) parts.push(`${missingFirstName} without First Name`)
  if (duplicatesInFile > 0) parts.push(`${duplicatesInFile} duplicates within file`)
  if (duplicatesInDB > 0) parts.push(`${duplicatesInDB} already in system`)
  const skipNote = parts.length > 0 ? ` Skipped: ${parts.join(', ')}.` : ''

  return NextResponse.json({
    ok: true,
    total: totalRows,
    inserted,
    skipped: totalSkipped,
    message: `${inserted} of ${totalRows} contacts imported.${skipNote}`,
  })
}
