'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, RefreshCw, Mail, MessageSquareReply, ThumbsUp, CalendarCheck, AlertTriangle,
  MailCheck, ShieldCheck, CheckCircle2, XCircle, MinusCircle, ArrowRight, Flame, Inbox, ExternalLink, UserX,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fmtDate } from '@/lib/account-pursuit/helpers'
import { buildDashboard, type RangeKey, type DashInput, type SegmentRow } from '@/lib/account-pursuit/dashboard'

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }, { key: '90d', label: '90 days' }, { key: 'all', label: 'All time' },
]

const CLASS_LABEL: Record<string, string> = {
  interested: 'Interested', question: 'Question', referral: 'Referral', not_now: 'Not now', not_interested: 'Not interested',
  unsubscribe: 'Unsubscribe', out_of_office: 'Auto-reply', bounce: 'Bounced', other: 'Other reply',
}
const CLASS_COLOR: Record<string, string> = {
  interested: '#059669', question: '#0284c7', referral: '#7c3aed', not_now: '#d97706', not_interested: '#e11d48',
  unsubscribe: '#be123c', out_of_office: '#94a3b8', bounce: '#f43f5e', other: '#64748b',
}
const STATUS_LABEL: Record<string, string> = {
  target: 'Target', engaged: 'Engaged', in_conversation: 'In conversation', opportunity: 'Opportunity', won: 'Won', lost: 'Lost', on_hold: 'On hold',
}

const pctText = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`
const card = 'bg-white border border-[#E5E5EA] rounded-2xl p-4'
const h2 = 'text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider'

function Kpi({ icon: Icon, label, value, sub, tone = 'teal' }: { icon: typeof Mail; label: string; value: string; sub?: string; tone?: 'teal' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky' }) {
  const tones: Record<string, string> = { teal: 'bg-teal-50 text-teal-700', emerald: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', sky: 'bg-sky-50 text-sky-700' }
  return (
    <div className={card}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}><Icon size={14} /></span>
        <span className="text-[11px] font-semibold text-[#6E6E73]">{label}</span>
      </div>
      <p className="text-[26px] font-extrabold text-[#1D1D1F] leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-[#AEAEB2] mt-1.5">{sub}</p>}
    </div>
  )
}

function SegmentTable({ title, rows }: { title: string; rows: SegmentRow[] }) {
  return (
    <div className={card}>
      <p className={`${h2} mb-2`}>{title}</p>
      <table className="w-full text-[12px]">
        <thead><tr className="text-[#AEAEB2] text-[10px] uppercase tracking-wider">
          <th className="text-left font-semibold pb-1.5">Group</th><th className="text-right font-semibold pb-1.5">Contacts</th>
          <th className="text-right font-semibold pb-1.5">Emailed</th><th className="text-right font-semibold pb-1.5">Replied</th><th className="text-right font-semibold pb-1.5">Rate</th>
        </tr></thead>
        <tbody className="divide-y divide-[#F0F0F2]">
          {rows.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-[#AEAEB2]">No emails sent yet</td></tr>}
          {rows.map(r => (
            <tr key={r.label}>
              <td className="py-1.5 text-[#1D1D1F] font-medium">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums text-[#6E6E73]">{r.contacts}</td>
              <td className="py-1.5 text-right tabular-nums">{r.emailed}</td>
              <td className="py-1.5 text-right tabular-nums">{r.replied}</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-teal-700">{r.emailed ? pctText(r.rate) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Check({ ok, label, detail }: { ok: 'good' | 'warn' | 'bad' | 'na'; label: string; detail: string }) {
  const Icon = ok === 'good' ? CheckCircle2 : ok === 'bad' ? XCircle : ok === 'warn' ? AlertTriangle : MinusCircle
  const cls = ok === 'good' ? 'text-emerald-600' : ok === 'bad' ? 'text-rose-600' : ok === 'warn' ? 'text-amber-600' : 'text-[#AEAEB2]'
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon size={15} className={`${cls} mt-0.5 flex-shrink-0`} />
      <div><p className="text-[12px] font-semibold text-[#1D1D1F]">{label}</p><p className="text-[11px] text-[#6E6E73]">{detail}</p></div>
    </div>
  )
}

export default function DashboardView({ raw, range, setRange, onRefresh }: { raw: DashInput; range: RangeKey; setRange: (r: RangeKey) => void; onRefresh: () => void }) {
  const D = useMemo(() => buildDashboard(raw, range), [raw, range])
  const { kpi, sending, trend, breakdown, funnel, accountStatus, touches, working, byTier, byRole, byState, byOwner, hot, recentReplies, health, coverage } = D
  const noSends = kpi.emailsSent === 0
  const totalSentForWorking = working[0]?.rows.reduce((s, r) => s + r.sent, 0) ?? 0
  const funnelMax = Math.max(1, ...funnel.map(f => f.value))
  const breakdownData = Object.entries(breakdown).map(([k, v]) => ({ name: CLASS_LABEL[k] ?? k, value: v, key: k })).sort((a, b) => b.value - a.value)
  const accountMax = Math.max(1, ...Object.values(accountStatus))
  const bounceTone: 'good' | 'warn' | 'bad' | 'na' = kpi.emailedContacts === 0 ? 'na' : kpi.bounceRate < 0.02 ? 'good' : kpi.bounceRate < 0.05 ? 'warn' : 'bad'
  const optTone: 'good' | 'warn' | 'bad' | 'na' = kpi.emailedContacts === 0 ? 'na' : kpi.optOutRate < 0.01 ? 'good' : kpi.optOutRate < 0.03 ? 'warn' : 'bad'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-2.5"><LayoutDashboard size={20} className="text-teal-600" /><h1 className="text-[20px] font-bold text-[#1D1D1F]">Outreach dashboard</h1></div>
          <p className="text-[12px] text-[#6E6E73] mt-0.5">How the email agents are performing: sending, replies, what works, and what needs you.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#E5E5EA] overflow-hidden bg-white">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 text-[12px] font-medium transition ${range === r.key ? 'bg-teal-600 text-white' : 'text-[#6E6E73] hover:bg-[#F5F5F7]'}`}>{r.label}</button>
            ))}
          </div>
          <button onClick={onRefresh} className="h-8 w-8 rounded-lg border border-[#E5E5EA] bg-white text-[#6E6E73] hover:text-teal-700 flex items-center justify-center" title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* sending status */}
      <div className={`${card} mb-4 flex items-center gap-x-5 gap-y-1 flex-wrap text-[12px]`}>
        <span className="flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
          <span className={`inline-block w-2 h-2 rounded-full ${sending.killSwitch ? 'bg-rose-500' : 'bg-emerald-500'}`} />{sending.killSwitch ? 'Sending is PAUSED' : 'Sending is on'}
        </span>
        <span className="text-[#6E6E73]">Today: <b className="text-[#1D1D1F]">{sending.sentToday}</b> of <b className="text-[#1D1D1F]">{sending.cap}</b> allowed</span>
        <span className="text-[#6E6E73]">{sending.day === 0 ? 'Warm-up not started (first send starts it)' : `Warm-up day ${sending.day}`}{sending.nextCap && sending.nextRiseOn ? ` · rises to ${sending.nextCap}/day on ${fmtDate(sending.nextRiseOn)}` : sending.cap >= sending.baseCap ? ' · full speed' : ''}</span>
        <Link href="/account-pursuit/drafts" className="ml-auto text-teal-700 font-semibold hover:underline inline-flex items-center gap-1">
          {kpi.pendingApproval} waiting for approval <ArrowRight size={12} />
        </Link>
      </div>

      {noSends && (
        <div className="mb-4 text-[12px] text-sky-800 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2.5">
          No emails were sent in this period yet, so most numbers below are zero. They fill in as emails go out and replies arrive.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi icon={Mail} label="Emails sent" value={String(kpi.emailsSent)} sub={`to ${kpi.emailedContacts} people`} />
        <Kpi icon={MessageSquareReply} label="Reply rate" value={kpi.emailedContacts ? pctText(kpi.replyRate) : '-'} sub={`${kpi.repliedContacts} replied (any answer)`} tone="sky" />
        <Kpi icon={ThumbsUp} label="Positive replies" value={String(kpi.positiveContacts)} sub={kpi.emailedContacts ? `${pctText(kpi.positiveRate, 1)} of people emailed` : 'interested, question, referral'} tone="emerald" />
        <Kpi icon={Flame} label="Interested" value={String(kpi.interested)} sub="asked to talk or for details" tone="emerald" />
        <Kpi icon={CalendarCheck} label="Meetings booked" value={String(kpi.meetings)} sub="all time" tone="violet" />
        <Kpi icon={AlertTriangle} label="Bounced" value={kpi.emailedContacts ? pctText(kpi.bounceRate, 1) : '-'} sub={`${kpi.bounced} bad address${kpi.bounced === 1 ? '' : 'es'}`} tone={bounceTone === 'bad' ? 'rose' : bounceTone === 'warn' ? 'amber' : 'teal'} />
        <Kpi icon={UserX} label="Opt-outs / declines" value={String(kpi.optOuts + kpi.declined)} sub={`${kpi.optOuts} unsubscribed · ${kpi.declined} said no`} tone="rose" />
        <Kpi icon={MailCheck} label="Needs your approval" value={String(kpi.pendingApproval)} sub={`${kpi.queued} approved and queued`} tone="amber" />
      </div>

      {/* trend + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className={`${card} lg:col-span-2`}>
          <p className={`${h2} mb-3`}>Emails sent vs replies, per day</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#AEAEB2' }} interval={Math.max(0, Math.floor(trend.length / 8) - 1)} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#AEAEB2' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#F5F5F7' }} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E5E5EA' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sent" name="Emails sent" fill="#0D9488" radius={[3, 3, 0, 0]} />
                <Bar dataKey="replies" name="Replies" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={card}>
          <p className={`${h2} mb-2`}>What people said</p>
          {breakdownData.length === 0 ? <p className="text-[12px] text-[#AEAEB2] py-16 text-center">No replies yet</p> : (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdownData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                      {breakdownData.map(d => <Cell key={d.key} fill={CLASS_COLOR[d.key] ?? '#64748b'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E5E5EA' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-1">
                {breakdownData.map(d => (
                  <div key={d.key} className="flex items-center gap-2 text-[12px]">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CLASS_COLOR[d.key] ?? '#64748b' }} />
                    <span className="text-[#1D1D1F]">{d.name}</span><span className="ml-auto tabular-nums font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* funnel + accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className={`${card} lg:col-span-2`}>
          <p className={`${h2} mb-3`}>Outreach funnel (all time, people)</p>
          <div className="space-y-2.5">
            {funnel.map((f, i) => (
              <div key={f.label}>
                <div className="flex items-baseline justify-between text-[12px] mb-1">
                  <span className="text-[#1D1D1F] font-medium">{f.label}</span>
                  <span className="tabular-nums"><b className="text-[#1D1D1F]">{f.value}</b>{i > 0 && funnel[i - 1].value > 0 && <span className="text-[#AEAEB2]"> · {pctText(f.value / funnel[i - 1].value)} of previous step</span>}</span>
                </div>
                <div className="h-2.5 bg-[#F0F0F2] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600" style={{ width: `${Math.max(f.value ? 2 : 0, (f.value / funnelMax) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className={card}>
          <p className={`${h2} mb-3`}>Firms by status</p>
          <div className="space-y-2">
            {Object.entries(STATUS_LABEL).map(([k, label]) => {
              const v = accountStatus[k] ?? 0
              return (
                <div key={k} className="flex items-center gap-2 text-[12px]">
                  <span className="w-28 text-[#1D1D1F]">{label}</span>
                  <div className="flex-1 h-2 bg-[#F0F0F2] rounded-full overflow-hidden"><div className="h-full bg-sky-500 rounded-full" style={{ width: `${(v / accountMax) * 100}%` }} /></div>
                  <span className="w-8 text-right tabular-nums font-semibold">{v}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* touches + what's working */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className={card}>
          <p className={`${h2} mb-2`}>Replies by email number</p>
          <table className="w-full text-[12px]">
            <thead><tr className="text-[#AEAEB2] text-[10px] uppercase tracking-wider"><th className="text-left font-semibold pb-1.5">Email</th><th className="text-right font-semibold pb-1.5">Sent</th><th className="text-right font-semibold pb-1.5">Replies</th><th className="text-right font-semibold pb-1.5">Rate</th></tr></thead>
            <tbody className="divide-y divide-[#F0F0F2]">
              {touches.map(t => (
                <tr key={t.touch}><td className="py-1.5 font-medium text-[#1D1D1F]">{t.touch === 1 ? 'First email' : t.touch === 2 ? 'Follow-up 1' : 'Follow-up 2'}</td>
                  <td className="py-1.5 text-right tabular-nums">{t.sent}</td><td className="py-1.5 text-right tabular-nums">{t.replies}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-teal-700">{t.sent ? pctText(t.rate) : '-'}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-[#AEAEB2] mt-2">Each reply is credited to the last email sent before it.</p>
        </div>

        <div className={`${card} lg:col-span-2`}>
          <div className="flex items-center justify-between mb-2">
            <p className={h2}>What gets replies</p>
            {totalSentForWorking < 30 && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Early days: {totalSentForWorking} emails, treat as a hint, not a verdict</span>}
          </div>
          {working.length === 0 ? <p className="text-[12px] text-[#AEAEB2] py-8 text-center">Appears once emails written by the agents have been sent.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {working.map(w => (
                <div key={w.dimension}>
                  <p className="text-[11px] font-semibold text-[#6E6E73] mb-1">{w.dimension}</p>
                  {w.rows.slice(0, 4).map(r => (
                    <div key={r.label} className="flex items-center gap-2 text-[12px] py-0.5">
                      <span className="text-[#1D1D1F] truncate flex-1" title={r.label}>{r.label}</span>
                      <span className="text-[#AEAEB2] tabular-nums">{r.replies}/{r.sent}</span>
                      <span className="w-10 text-right tabular-nums font-semibold text-teal-700">{r.sent ? pctText(r.rate) : '-'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <SegmentTable title="By firm tier" rows={byTier} />
        <SegmentTable title="By role" rows={byRole} />
        <SegmentTable title="By state (top 8)" rows={byState} />
        <SegmentTable title="By owner" rows={byOwner} />
      </div>

      {/* hot + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className={card}>
          <p className={`${h2} mb-2 flex items-center gap-1.5`}><Flame size={13} className="text-emerald-600" /> Act now</p>
          {hot.length === 0 ? <p className="text-[12px] text-[#AEAEB2] py-6 text-center">Nobody is waiting on you. Interested replies appear here.</p> : (
            <div className="divide-y divide-[#F0F0F2]">
              {hot.map(h => (
                <Link key={h.id} href={`/account-pursuit/contacts/${h.id}`} className="block py-2 hover:bg-[#FAFAFA] -mx-2 px-2 rounded-lg transition">
                  <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-[#1D1D1F]">{h.name}</span><span className="text-[11px] text-[#6E6E73]">{h.firm}</span><ExternalLink size={11} className="ml-auto text-[#AEAEB2]" /></div>
                  <p className="text-[11px] text-emerald-700 font-medium">{h.nextAction ?? 'In conversation'}{h.due ? ` · ${fmtDate(h.due)}` : ''}</p>
                  {h.summary && <p className="text-[11px] text-[#6E6E73] italic">&ldquo;{h.summary}&rdquo;</p>}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className={card}>
          <p className={`${h2} mb-2 flex items-center gap-1.5`}><Inbox size={13} className="text-sky-600" /> Latest replies</p>
          {recentReplies.length === 0 ? <p className="text-[12px] text-[#AEAEB2] py-6 text-center">No replies yet.</p> : (
            <div className="divide-y divide-[#F0F0F2]">
              {recentReplies.map(r => (
                <Link key={r.id} href={`/account-pursuit/contacts/${r.contactId}`} className="block py-2 hover:bg-[#FAFAFA] -mx-2 px-2 rounded-lg transition">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#1D1D1F]">{r.name}</span><span className="text-[11px] text-[#6E6E73] truncate">{r.firm}</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider" style={{ color: CLASS_COLOR[r.cls] ?? '#64748b' }}>{CLASS_LABEL[r.cls] ?? r.cls}</span>
                  </div>
                  <p className="text-[11px] text-[#6E6E73]">{r.summary ?? ''} <span className="text-[#AEAEB2]">· {fmtDate(r.at)}</span></p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* health */}
      <div className={card}>
        <p className={`${h2} mb-1 flex items-center gap-1.5`}><ShieldCheck size={13} className="text-teal-600" /> Health checks</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <Check ok={bounceTone} label="Bounce rate" detail={kpi.emailedContacts ? `${pctText(kpi.bounceRate, 1)} bounced. Under 2% is healthy, over 5% hurts your sender reputation.` : 'Shows once emails are sent.'} />
            <Check ok={optTone} label="Opt-outs" detail={kpi.emailedContacts ? `${pctText(kpi.optOutRate, 1)} asked to stop. Keep this under 1%.` : 'Shows once emails are sent.'} />
            <Check ok={health.decided === 0 ? 'na' : health.approvalRate >= 0.7 ? 'good' : 'warn'} label="Draft approval rate" detail={health.decided ? `${pctText(health.approvalRate)} of ${health.decided} reviewed drafts were approved. A low rate means the writer needs tuning.` : 'No drafts reviewed yet.'} />
            <Check ok={health.avgQa == null ? 'na' : health.avgQa >= 80 ? 'good' : 'warn'} label="Average draft quality" detail={health.avgQa == null ? 'No drafts in this period.' : `${health.avgQa.toFixed(0)} / 100 across ${health.draftsMade} drafts (automatic fact and spam-wording check).`} />
          </div>
          <div>
            <Check ok={coverage.overdue === 0 ? 'good' : 'warn'} label="Overdue follow-ups" detail={coverage.overdue === 0 ? 'Nothing overdue.' : `${coverage.overdue} contact${coverage.overdue === 1 ? ' has' : 's have'} a follow-up past its date.`} />
            <Check ok={coverage.tierA === 0 ? 'na' : coverage.tierACovered / coverage.tierA >= 0.5 ? 'good' : 'warn'} label="Tier A coverage" detail={`${coverage.tierACovered} of ${coverage.tierA} top firms have been emailed.`} />
            <Check ok={coverage.backlog === 0 ? 'good' : 'na'} label="Not yet contacted" detail={`${coverage.backlog} people with an email have not been emailed.${coverage.backlogDays ? ` At ${sending.cap}/day that is about ${coverage.backlogDays} working days.` : ''}`} />
            <Check ok={sending.killSwitch ? 'bad' : 'good'} label="Sending switch" detail={sending.killSwitch ? 'All sending is paused.' : 'Sending is on.'} />
          </div>
        </div>
      </div>
    </div>
  )
}
