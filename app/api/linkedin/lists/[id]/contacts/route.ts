import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// POST /api/linkedin/lists/[id]/contacts — add contacts to a list
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { contactIds } = await req.json() as { contactIds: string[] }
  if (!contactIds?.length) return NextResponse.json({ error: 'No contacts specified.' }, { status: 400 })

  const rows = contactIds.map(cid => ({ list_id: id, contact_id: cid, added_by: user.id }))
  const { error } = await supabase
    .from('linkedin_list_contacts')
    .upsert(rows, { onConflict: 'list_id,contact_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, added: contactIds.length })
}

// DELETE /api/linkedin/lists/[id]/contacts — remove contacts from a list
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { contactIds } = await req.json() as { contactIds: string[] }
  if (!contactIds?.length) return NextResponse.json({ error: 'No contacts specified.' }, { status: 400 })

  const { error } = await supabase
    .from('linkedin_list_contacts')
    .delete()
    .eq('list_id', id)
    .in('contact_id', contactIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
