'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2, Check, Clock, ChevronRight, Building2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todayISO, businessDaysFromToday, fmtDate, fullName } from '@/lib/account-pursuit/helpers'
import { ConnectionBadge, StageBadge } from '@/components/account-pursuit/badges'
import type { AbmContact } from '@/lib/account-pursuit/types'

type Row = AbmContact & { account: { name: string } | null }

export default function FollowUpsDuePage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('abm_contacts')
      .select('*, account:abm_accounts(name)')
      .not('next_action_date', 'is', null)
      .eq('do_not_contact', false)
      .order('next_action_date', { ascending: true })
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function done(r: Row) {
    setBusyId(r.id)
    const supabase = createClient()
    await supabase.from('abm_contacts').update({ next_action: null, next_action_date: null }).eq('id', r.id)
    setRows(prev => prev.filter(x => x.id !== r.id))
    setBusyId(null)
  }

  async function snooze(r: Row, days: number) {
    setBusyId(r.id)
    const date = businessDaysFromToday(days)
    const supabase = createClient()
    await supabase.from('abm_contacts').update({ next_action_date: date }).eq('id', r.id)
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, next_action_date: date } : x)
      .sort((a, b) => (a.next_action_date ?? '').localeCompare(b.next_action_date ?? '')))
    setBusyId(null)
  }

  const today = todayISO()
  const groups = useMemo(() => {
    const overdue: Row[] = [], due: Row[] = [], upcoming: Row[] = []
    for (const r of rows) {
      const d = r.next_action_date!
      if (d < today) overdue.push(r)
      else if (d === today) due.push(r)
      else upcoming.push(r)
    }
    return { overdue, due, upcoming }
  }, [rows, today])

  const actionable = groups.overdue.length + groups.due.length

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
          <CalendarClock size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-[19px] font-bold text-[#1D1D1F] leading-tight">Follow-ups Due</h1>
          <p className="text-[12px] text-[#6E6E73]">
            {loading ? 'Loading…' : actionable > 0 ? `${actionable} to action now · ${groups.upcoming.length} upcoming` : 'You\'re all caught up'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin text-teal-600" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-[#E5E5EA] rounded-2xl py-16 text-center">
          <CheckCircle2 size={26} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-[#1D1D1F]">Nothing scheduled</p>
          <p className="text-[12px] text-[#AEAEB2] mt-1">Set a next step on any contact and it shows up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Overdue" tone="overdue" rows={groups.overdue} busyId={busyId} onOpen={r => router.push(`/account-pursuit/contacts/${r.id}`)} onDone={done} onSnooze={snooze} />
          <Section title="Due today" tone="today" rows={groups.due} busyId={busyId} onOpen={r => router.push(`/account-pursuit/contacts/${r.id}`)} onDone={done} onSnooze={snooze} />
          <Section title="Upcoming" tone="later" rows={groups.upcoming} busyId={busyId} onOpen={r => router.push(`/account-pursuit/contacts/${r.id}`)} onDone={done} onSnooze={snooze} />
        </div>
      )}
    </div>
  )
}

function Section({ title, tone, rows, busyId, onOpen, onDone, onSnooze }: {
  title: string; tone: 'overdue' | 'today' | 'later'; rows: Row[]; busyId: string | null
  onOpen: (r: Row) => void; onDone: (r: Row) => void; onSnooze: (r: Row, days: number) => void
}) {
  if (rows.length === 0) return null
  const dot = tone === 'overdue' ? 'bg-rose-500' : tone === 'today' ? 'bg-amber-500' : 'bg-slate-300'
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <h2 className="text-[12px] font-bold text-[#6E6E73] uppercase tracking-wider">{title}</h2>
        <span className="text-[11px] text-[#AEAEB2]">({rows.length})</span>
      </div>
      <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden divide-y divide-[#F2F2F7]">
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition group">
            <button onClick={() => onDone(r)} disabled={busyId === r.id}
              title="Mark done" className="w-6 h-6 rounded-full border-2 border-[#D1D1D6] hover:border-teal-500 hover:bg-teal-50 flex items-center justify-center flex-shrink-0 transition">
              {busyId === r.id ? <Loader2 size={12} className="animate-spin text-teal-600" /> : <Check size={12} className="text-transparent group-hover:text-teal-600" />}
            </button>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(r)}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#1D1D1F]">{fullName(r)}</span>
                {r.account && <span className="inline-flex items-center gap-1 text-[11px] text-[#AEAEB2]"><Building2 size={10} /> {r.account.name}</span>}
              </div>
              <p className="text-[12px] text-[#1D1D1F] mt-0.5 truncate">{r.next_action}</p>
              <div className="flex items-center gap-2 mt-1">
                <ConnectionBadge value={r.connection_status} />
                <StageBadge value={r.conversation_stage} />
                <span className="text-[11px] text-[#AEAEB2]">{fmtDate(r.next_action_date)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onSnooze(r, 3)} disabled={busyId === r.id}
                title="Snooze 3 business days"
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:border-teal-400 hover:text-teal-700 transition">
                <Clock size={11} /> +3d
              </button>
              <button onClick={() => onOpen(r)} className="text-[#D1D1D6] hover:text-teal-600 p-1"><ChevronRight size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
