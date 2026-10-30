'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RangeKey, MsgLite, DraftLite, ContactLite, AccountLite, SettingsLite, DashInput } from '@/lib/account-pursuit/dashboard'
import DashboardView from '@/components/account-pursuit/dashboard-view'

async function pageAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await q(from, from + 999)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [raw, setRaw] = useState<DashInput | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const sb = createClient()
      const [messages, drafts, contacts, accounts, settingsRes, profs] = await Promise.all([
        pageAll<MsgLite>((a, b) => sb.from('abm_messages').select('id,contact_id,direction,occurred_at,classification,summary,subject,draft_id').eq('channel', 'email').order('occurred_at', { ascending: true }).range(a, b)),
        pageAll<DraftLite>((a, b) => sb.from('abm_drafts').select('id,contact_id,account_id,status,sequence_step,sent_at,created_at,qa_score,angle,variant,approved_at').eq('channel', 'email').range(a, b)),
        pageAll<ContactLite>((a, b) => sb.from('abm_contacts').select('id,account_id,first_name,last_name,job_title,committee_role,conversation_stage,email,email_status,do_not_contact,owner_id,next_action,next_action_date').range(a, b)),
        pageAll<AccountLite>((a, b) => sb.from('abm_accounts').select('id,name,tier,status,state,owner_id').range(a, b)),
        sb.from('abm_agent_settings').select('daily_cap,kill_switch,timezone,send_start_hour,send_end_hour').eq('id', 1).single(),
        sb.from('profiles').select('id,name'),
      ])
      const names: Record<string, string> = {}
      for (const p of (profs.data ?? []) as { id: string; name: string }[]) names[p.id] = p.name
      setRaw({ messages, drafts, contacts, accounts, settings: (settingsRes.data as SettingsLite) ?? null, names })
    } catch {
      setError('Could not load the dashboard. Check your connection and try again.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !raw) {
    return (
      <div className="flex items-center justify-center h-64">
        {error ? <p className="text-[13px] text-rose-600">{error}</p> : <Loader2 size={22} className="animate-spin text-teal-600" />}
      </div>
    )
  }
  return <DashboardView raw={raw} range={range} setRange={setRange} onRefresh={load} />
}
