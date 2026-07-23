import type {
  AccountStatus, Tier, CommitteeRole, ConnectionStatus, ConversationStage, Channel,
} from './types'

export const ACCOUNT_STATUSES: { value: AccountStatus; label: string; cls: string }[] = [
  { value: 'target',          label: 'Target',          cls: 'bg-slate-100 text-slate-600' },
  { value: 'engaged',         label: 'Engaged',         cls: 'bg-sky-50 text-sky-700' },
  { value: 'in_conversation', label: 'In Conversation', cls: 'bg-blue-50 text-blue-700' },
  { value: 'opportunity',     label: 'Opportunity',     cls: 'bg-violet-50 text-violet-700' },
  { value: 'won',             label: 'Won',             cls: 'bg-emerald-50 text-emerald-700' },
  { value: 'lost',            label: 'Lost',            cls: 'bg-rose-50 text-rose-700' },
  { value: 'on_hold',         label: 'On Hold',         cls: 'bg-amber-50 text-amber-700' },
]

export const TIERS: { value: Tier; label: string; cls: string }[] = [
  { value: 'A', label: 'Tier A', cls: 'bg-emerald-100 text-emerald-800' },
  { value: 'B', label: 'Tier B', cls: 'bg-amber-100 text-amber-800' },
  { value: 'C', label: 'Tier C', cls: 'bg-slate-100 text-slate-600' },
]

export const COMMITTEE_ROLES: { value: CommitteeRole; label: string; cls: string }[] = [
  { value: 'decision_maker', label: 'Decision Maker', cls: 'bg-violet-50 text-violet-700' },
  { value: 'champion',       label: 'Champion',       cls: 'bg-emerald-50 text-emerald-700' },
  { value: 'influencer',     label: 'Influencer',     cls: 'bg-sky-50 text-sky-700' },
  { value: 'gatekeeper',     label: 'Gatekeeper',     cls: 'bg-amber-50 text-amber-700' },
  { value: 'unknown',        label: 'Unknown',        cls: 'bg-slate-100 text-slate-500' },
]

export const CONNECTION_STATUSES: { value: ConnectionStatus; label: string; cls: string }[] = [
  { value: 'not_sent',     label: 'Not Sent',     cls: 'bg-slate-100 text-slate-500' },
  { value: 'request_sent', label: 'Request Sent', cls: 'bg-amber-50 text-amber-700' },
  { value: 'accepted',     label: 'Accepted',     cls: 'bg-emerald-50 text-emerald-700' },
  { value: 'no_response',  label: 'No Response',  cls: 'bg-slate-100 text-slate-500' },
  { value: 'declined',     label: 'Declined',     cls: 'bg-rose-50 text-rose-700' },
]

export const CONVERSATION_STAGES: { value: ConversationStage; label: string; cls: string }[] = [
  { value: 'no_contact',      label: 'No Contact',      cls: 'bg-slate-100 text-slate-500' },
  { value: 'opener_sent',     label: 'Opener Sent',     cls: 'bg-sky-50 text-sky-700' },
  { value: 'replied',         label: 'Replied',         cls: 'bg-blue-50 text-blue-700' },
  { value: 'in_conversation', label: 'In Conversation', cls: 'bg-violet-50 text-violet-700' },
  { value: 'meeting_booked',  label: 'Meeting Booked',  cls: 'bg-emerald-50 text-emerald-700' },
  { value: 'cold',            label: 'Cold',            cls: 'bg-rose-50 text-rose-700' },
]

export const CHANNELS: { value: Channel; label: string; limit: number | null }[] = [
  { value: 'connect_note', label: 'Connection note', limit: 300 },
  { value: 'dm',           label: 'LinkedIn DM',      limit: null },
  { value: 'inmail',       label: 'InMail',           limit: null },
  { value: 'email',        label: 'Email',            limit: null },
]

// Quick presets for scheduling the next follow-up (business days from today)
export const NEXT_STEP_PRESETS = [
  { label: '+2d', days: 2 },
  { label: '+3d', days: 3 },
  { label: '+5d', days: 5 },
  { label: '+7d', days: 7 },
]

export const BRAND = '#0D9488' // teal-600, the module accent

export function styleFor<T extends string>(
  list: { value: T; label: string; cls: string }[],
  value: T | null | undefined,
) {
  return list.find(x => x.value === value) ?? list[0]
}
