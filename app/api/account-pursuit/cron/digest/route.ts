import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

// Daily digest: emails each owner their due Account Pursuit follow-ups.
// Triggered by Vercel Cron (see vercel.json). Guarded by CRON_SECRET when set.

type DueRow = {
  id: string
  first_name: string
  last_name: string | null
  next_action: string | null
  next_action_date: string | null
  owner_id: string | null
  account: { name: string } | null
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // no secret configured — allow (set CRON_SECRET to lock down)
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  if (new URL(req.url).searchParams.get('secret') === secret) return true
  return false
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: dueRaw, error } = await db
    .from('abm_contacts')
    .select('id, first_name, last_name, next_action, next_action_date, owner_id, account:abm_accounts(name)')
    .not('next_action_date', 'is', null)
    .lte('next_action_date', today)
    .eq('do_not_contact', false)
    .order('next_action_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const due = (dueRaw ?? []) as unknown as DueRow[]

  // Owner emails (only active users with the module)
  const { data: profs } = await db
    .from('profiles')
    .select('id, name, email, has_account_pursuit, is_active')
  const owners = new Map<string, { name: string; email: string }>()
  for (const p of (profs ?? []) as { id: string; name: string; email: string; has_account_pursuit: boolean; is_active: boolean }[]) {
    if (p.has_account_pursuit && p.is_active && p.email) owners.set(p.id, { name: p.name, email: p.email })
  }

  // Group due items by owner
  const byOwner = new Map<string, DueRow[]>()
  for (const r of due) {
    if (!r.owner_id || !owners.has(r.owner_id)) continue
    if (!byOwner.has(r.owner_id)) byOwner.set(r.owner_id, [])
    byOwner.get(r.owner_id)!.push(r)
  }

  let emailed = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finsmart-mms-hazel.vercel.app'
  for (const [ownerId, items] of byOwner) {
    const owner = owners.get(ownerId)!
    const rowsHtml = items.map(r => {
      const overdue = (r.next_action_date ?? '') < today
      const name = `${r.first_name} ${r.last_name ?? ''}`.trim()
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${name}${r.account?.name ? ` <span style="color:#888;">· ${r.account.name}</span>` : ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;color:#333;">${r.next_action ?? ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;color:${overdue ? '#dc2626' : '#666'};white-space:nowrap;">${overdue ? 'Overdue · ' : ''}${r.next_action_date}</td>
      </tr>`
    }).join('')

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;">
        <h2 style="font-size:17px;color:#0d9488;">Account Pursuit — ${items.length} follow-up${items.length === 1 ? '' : 's'} due</h2>
        <p style="font-size:13px;color:#555;">Good morning ${owner.name.split(' ')[0]}, here's who to touch today.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#999;text-transform:uppercase;">Contact</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#999;text-transform:uppercase;">Next step</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#999;text-transform:uppercase;">Due</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="margin-top:16px;"><a href="${appUrl}/account-pursuit" style="background:#0d9488;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;">Open Follow-ups Due</a></p>
      </div>`

    try {
      await sendEmail({ to: owner.email, subject: `${items.length} Account Pursuit follow-up${items.length === 1 ? '' : 's'} due today`, html })
      emailed++
    } catch { /* skip failed recipient, continue */ }
  }

  return NextResponse.json({ ok: true, owners_emailed: emailed, total_due: due.length })
}
