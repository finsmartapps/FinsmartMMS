// Account Pursuit outreach dashboard — all numbers are computed here from raw rows, so they are testable.
// No imports (types only) on purpose.

export type RangeKey = '7d' | '30d' | '90d' | 'all'

export interface MsgLite {
  id: string; contact_id: string; direction: 'sent' | 'received'; occurred_at: string
  classification: string | null; summary: string | null; subject: string | null; draft_id: string | null
}
export interface DraftLite {
  id: string; contact_id: string; account_id: string | null; status: string; sequence_step: number
  sent_at: string | null; created_at: string; qa_score: number | null; angle: string | null
  variant: Record<string, unknown> | null; approved_at: string | null
}
export interface ContactLite {
  id: string; account_id: string; first_name: string; last_name: string | null; job_title: string | null
  committee_role: string; conversation_stage: string; email: string | null; email_status?: string | null
  do_not_contact: boolean; owner_id: string | null; next_action: string | null; next_action_date: string | null
}
export interface AccountLite { id: string; name: string; tier: string | null; status: string; state: string | null; owner_id: string | null }
export interface SettingsLite { daily_cap: number; kill_switch: boolean; timezone: string; send_start_hour: number; send_end_hour: number }

export interface DashInput {
  messages: MsgLite[]; drafts: DraftLite[]; contacts: ContactLite[]; accounts: AccountLite[]
  settings: SettingsLite | null; names: Record<string, string>
}

const NON_HUMAN = new Set(['bounce', 'out_of_office'])
const POSITIVE = new Set(['interested', 'question', 'referral'])
const DAY = 86_400_000

export interface Rate { sent: number; replies: number; rate: number }
export interface SegmentRow { label: string; contacts: number; emailed: number; replied: number; positive: number; rate: number }

const pct = (a: number, b: number) => (b > 0 ? a / b : 0)
const dayKey = (iso: string | number | Date) => new Date(iso).toISOString().slice(0, 10)

function shortLabel(s: unknown): string {
  const t = String(s ?? '').replace(/^(open|end)( with| by)?\s+/i, '').trim()
  const w = t.split(/\s+/).slice(0, 7).join(' ')
  return w.length ? w.charAt(0).toUpperCase() + w.slice(1) : 'Unknown'
}

function angleGroup(angle: string | null): string {
  if (!angle) return 'No specific fact'
  if (angle.startsWith('r:')) return 'Researched fact (news / website)'
  const m: Record<string, string> = {
    compelling_event: 'Imported: recent event', pain: 'Imported: pain point', associations: 'Imported: associations',
    software: 'Imported: software they use', offshore: 'Imported: offshore setup', vertical: 'Imported: vertical',
    size: 'Imported: firm size', location: 'Imported: location',
  }
  return m[angle] ?? 'Other'
}

export function warmupCapFor(firstSentAt: string | null, baseCap: number, now = Date.now()): { cap: number; day: number; nextRiseOn: string | null; nextCap: number | null } {
  if (!firstSentAt) return { cap: Math.min(baseCap, 5), day: 0, nextRiseOn: null, nextCap: Math.min(baseCap, 10) }
  const first = new Date(firstSentAt).getTime()
  const days = Math.floor((now - first) / DAY)
  const steps = [5, 10, 15, 20]
  const idx = Math.min(3, Math.floor(days / 7))
  const cap = Math.min(baseCap, steps[idx])
  const nextCap = idx < 3 && steps[idx + 1] <= baseCap ? steps[idx + 1] : null
  const nextRiseOn = nextCap ? new Date(first + (idx + 1) * 7 * DAY).toISOString().slice(0, 10) : null
  return { cap, day: days + 1, nextRiseOn, nextCap }
}

export function buildDashboard(input: DashInput, range: RangeKey, nowMs = Date.now()) {
  const { messages, drafts, contacts, accounts, settings, names } = input
  const since = range === 'all' ? 0 : nowMs - ({ '7d': 7, '30d': 30, '90d': 90 } as const)[range] * DAY
  const inRange = (iso: string) => new Date(iso).getTime() >= since

  const contactById = new Map(contacts.map(c => [c.id, c]))
  const accountById = new Map(accounts.map(a => [a.id, a]))
  const draftById = new Map(drafts.map(d => [d.id, d]))

  const sentAll = messages.filter(m => m.direction === 'sent').sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const recvAll = messages.filter(m => m.direction === 'received').sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const humanRepliesAll = recvAll.filter(m => !NON_HUMAN.has(m.classification ?? 'other'))

  // per-contact sent history (ascending)
  const sentByContact = new Map<string, MsgLite[]>()
  for (const m of sentAll) { if (!sentByContact.has(m.contact_id)) sentByContact.set(m.contact_id, []); sentByContact.get(m.contact_id)!.push(m) }

  // which sent email triggered each reply: the last one sent before it
  const triggerOf = (reply: MsgLite): { sent: MsgLite; touch: number } | null => {
    const list = sentByContact.get(reply.contact_id) ?? []
    let idx = -1
    for (let i = 0; i < list.length; i++) if (list[i].occurred_at <= reply.occurred_at) idx = i
    return idx >= 0 ? { sent: list[idx], touch: idx + 1 } : null
  }

  // ── cohort: contacts whose first email falls in the period ──
  const emailedAll = new Set(sentByContact.keys())
  const cohort = new Set([...emailedAll].filter(id => inRange(sentByContact.get(id)![0].occurred_at)))
  const repliedContacts = new Set(humanRepliesAll.map(m => m.contact_id))
  const positiveContacts = new Set(humanRepliesAll.filter(m => POSITIVE.has(m.classification ?? '')).map(m => m.contact_id))
  const interestedContacts = new Set(humanRepliesAll.filter(m => m.classification === 'interested').map(m => m.contact_id))
  const bouncedContacts = new Set(recvAll.filter(m => m.classification === 'bounce').map(m => m.contact_id))
  const optOutContacts = new Set(recvAll.filter(m => m.classification === 'unsubscribe').map(m => m.contact_id))
  const declinedContacts = new Set(recvAll.filter(m => m.classification === 'not_interested').map(m => m.contact_id))
  const cohortSize = cohort.size
  const countIn = (s: Set<string>) => [...cohort].filter(id => s.has(id)).length

  const emailsSent = sentAll.filter(m => inRange(m.occurred_at)).length
  const meetings = contacts.filter(c => c.conversation_stage === 'meeting_booked').length

  // ── trend ──
  const nDays = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const trend: { day: string; label: string; sent: number; replies: number }[] = []
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * DAY)
    trend.push({ day: dayKey(d), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sent: 0, replies: 0 })
  }
  const tIdx = new Map(trend.map((t, i) => [t.day, i]))
  for (const m of sentAll) { const i = tIdx.get(dayKey(m.occurred_at)); if (i != null) trend[i].sent++ }
  for (const m of humanRepliesAll) { const i = tIdx.get(dayKey(m.occurred_at)); if (i != null) trend[i].replies++ }

  // ── reply breakdown (period) ──
  const breakdown: Record<string, number> = {}
  for (const m of recvAll.filter(m => inRange(m.occurred_at))) { const k = m.classification ?? 'other'; breakdown[k] = (breakdown[k] ?? 0) + 1 }

  // ── contact funnel (all time) ──
  const withEmail = contacts.filter(c => !!c.email && !c.do_not_contact && c.email_status !== 'bounced').length
  const funnel = [
    { label: 'Contacts with a usable email', value: withEmail },
    { label: 'Emailed', value: emailedAll.size },
    { label: 'Replied (a real person)', value: repliedContacts.size },
    { label: 'Positive (interested / question / referral)', value: positiveContacts.size },
    { label: 'Meeting booked', value: meetings },
  ]

  const accountStatus: Record<string, number> = {}
  for (const a of accounts) accountStatus[a.status] = (accountStatus[a.status] ?? 0) + 1

  // ── per-touch performance (period) ──
  const touches = [1, 2, 3].map(t => {
    let sent = 0
    for (const list of sentByContact.values()) if (list[t - 1] && inRange(list[t - 1].occurred_at)) sent++
    const replies = humanRepliesAll.filter(r => { const x = triggerOf(r); return x && x.touch === t && inRange(x.sent.occurred_at) }).length
    return { touch: t, sent, replies, rate: pct(replies, sent) } as Rate & { touch: number }
  })

  // ── what's working: attribute replies to the draft that triggered them ──
  const dims: Record<string, Map<string, { sent: number; replies: number }>> = {
    'Angle (what the email was built on)': new Map(), 'Opening style': new Map(), 'Structure': new Map(), 'How it ends': new Map(), 'Length (target words)': new Map(),
  }
  const bump = (dim: string, label: string, key: 'sent' | 'replies') => {
    const m = dims[dim]; const cur = m.get(label) ?? { sent: 0, replies: 0 }; cur[key]++; m.set(label, cur)
  }
  const labelsFor = (d: DraftLite | undefined): [string, string][] => d ? [
    ['Angle (what the email was built on)', angleGroup(d.angle)],
    ['Opening style', shortLabel(d.variant?.opening)],
    ['Structure', shortLabel(d.variant?.structure)],
    ['How it ends', shortLabel(d.variant?.cta)],
    ['Length (target words)', d.variant?.targetWords ? `~${d.variant.targetWords} words` : 'Unknown'],
  ] : []
  for (const m of sentAll.filter(m => inRange(m.occurred_at))) for (const [dim, lab] of labelsFor(m.draft_id ? draftById.get(m.draft_id) : undefined)) bump(dim, lab, 'sent')
  for (const r of humanRepliesAll) {
    const x = triggerOf(r); if (!x || !inRange(x.sent.occurred_at)) continue
    for (const [dim, lab] of labelsFor(x.sent.draft_id ? draftById.get(x.sent.draft_id) : undefined)) bump(dim, lab, 'replies')
  }
  const working = Object.entries(dims).map(([dimension, map]) => ({
    dimension,
    rows: [...map.entries()].map(([label, v]) => ({ label, sent: v.sent, replies: v.replies, rate: pct(v.replies, v.sent) })).sort((a, b) => b.sent - a.sent),
  })).filter(d => d.rows.length > 0)

  // ── segments ──
  const segment = (keyOf: (c: ContactLite) => string | null): SegmentRow[] => {
    const map = new Map<string, SegmentRow>()
    for (const c of contacts) {
      const k = keyOf(c) ?? 'Unknown'
      if (!map.has(k)) map.set(k, { label: k, contacts: 0, emailed: 0, replied: 0, positive: 0, rate: 0 })
      const r = map.get(k)!
      r.contacts++
      if (emailedAll.has(c.id)) { r.emailed++; if (repliedContacts.has(c.id)) r.replied++; if (positiveContacts.has(c.id)) r.positive++ }
    }
    for (const r of map.values()) r.rate = pct(r.replied, r.emailed)
    return [...map.values()]
  }
  const byTier = segment(c => { const t = accountById.get(c.account_id)?.tier; return t ? `Tier ${t}` : 'No tier' }).sort((a, b) => a.label.localeCompare(b.label))
  const roleLabels: Record<string, string> = { decision_maker: 'Decision maker', champion: 'Champion', influencer: 'Influencer', gatekeeper: 'Gatekeeper', unknown: 'Unknown' }
  const byRole = segment(c => roleLabels[c.committee_role] ?? c.committee_role).sort((a, b) => b.emailed - a.emailed)
  const byState = segment(c => accountById.get(c.account_id)?.state ?? null).filter(r => r.emailed > 0).sort((a, b) => b.emailed - a.emailed).slice(0, 8)
  const byOwner = segment(c => (c.owner_id ? names[c.owner_id] ?? 'Unknown' : 'Unassigned')).sort((a, b) => b.contacts - a.contacts)

  // ── action lists ──
  const today = dayKey(nowMs)
  const lastReplyOf = new Map<string, MsgLite>()
  for (const m of humanRepliesAll) lastReplyOf.set(m.contact_id, m)
  const HOT = /interested|reply today|answer their question|referred|read and respond/i
  const hot = contacts
    .filter(c => !c.do_not_contact && (c.conversation_stage === 'in_conversation' || (c.next_action && HOT.test(c.next_action) && (c.next_action_date ?? '9999') <= today)))
    .map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name ?? ''}`.trim(), title: c.job_title, firm: accountById.get(c.account_id)?.name ?? '', stage: c.conversation_stage, nextAction: c.next_action, due: c.next_action_date, summary: lastReplyOf.get(c.id)?.summary ?? null, repliedAt: lastReplyOf.get(c.id)?.occurred_at ?? null }))
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')).slice(0, 8)

  const recentReplies = [...humanRepliesAll].reverse().slice(0, 10).map(m => {
    const c = contactById.get(m.contact_id)
    return { id: m.id, contactId: m.contact_id, name: c ? `${c.first_name} ${c.last_name ?? ''}`.trim() : 'Unknown', firm: c ? accountById.get(c.account_id)?.name ?? '' : '', cls: m.classification ?? 'other', summary: m.summary, at: m.occurred_at }
  })

  // ── sending & health ──
  const firstSent = drafts.filter(d => d.status === 'sent' && d.sent_at).map(d => d.sent_at as string).sort()[0] ?? sentAll[0]?.occurred_at ?? null
  const warm = warmupCapFor(firstSent, settings?.daily_cap ?? 20, nowMs)
  const sentToday = sentAll.filter(m => dayKey(m.occurred_at) === today).length
  const decided = drafts.filter(d => ['approved', 'sent', 'rejected'].includes(d.status))
  const approvedLike = decided.filter(d => d.status !== 'rejected').length
  const draftsInRange = drafts.filter(d => inRange(d.created_at))
  const qaVals = draftsInRange.map(d => d.qa_score).filter((x): x is number => x != null)
  const backlog = contacts.filter(c => !!c.email && !c.do_not_contact && c.email_status !== 'bounced' && !emailedAll.has(c.id) && c.conversation_stage === 'no_contact').length
  const tierA = accounts.filter(a => a.tier === 'A')
  const tierACovered = tierA.filter(a => contacts.some(c => c.account_id === a.id && emailedAll.has(c.id))).length
  const overdue = contacts.filter(c => !c.do_not_contact && c.next_action_date && c.next_action_date < today).length

  return {
    kpi: {
      emailsSent, emailedContacts: cohortSize, repliedContacts: countIn(repliedContacts), replyRate: pct(countIn(repliedContacts), cohortSize),
      positiveContacts: countIn(positiveContacts), positiveRate: pct(countIn(positiveContacts), cohortSize), interested: countIn(interestedContacts),
      meetings, bounced: countIn(bouncedContacts), bounceRate: pct(countIn(bouncedContacts), cohortSize),
      optOuts: countIn(optOutContacts), optOutRate: pct(countIn(optOutContacts), cohortSize), declined: countIn(declinedContacts),
      pendingApproval: drafts.filter(d => d.status === 'pending_approval').length, queued: drafts.filter(d => d.status === 'approved').length,
    },
    sending: { sentToday, cap: warm.cap, day: warm.day, nextCap: warm.nextCap, nextRiseOn: warm.nextRiseOn, killSwitch: !!settings?.kill_switch, baseCap: settings?.daily_cap ?? 20 },
    trend, breakdown, funnel, accountStatus, touches, working, byTier, byRole, byState, byOwner, hot, recentReplies,
    health: { approvalRate: pct(approvedLike, decided.length), decided: decided.length, avgQa: qaVals.length ? qaVals.reduce((a, b) => a + b, 0) / qaVals.length : null, draftsMade: draftsInRange.length },
    coverage: { backlog, backlogDays: warm.cap > 0 ? Math.ceil(backlog / warm.cap) : null, tierA: tierA.length, tierACovered, overdue },
  }
}
