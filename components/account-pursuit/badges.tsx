import {
  ACCOUNT_STATUSES, TIERS, COMMITTEE_ROLES, CONNECTION_STATUSES, CONVERSATION_STAGES, styleFor,
} from '@/lib/account-pursuit/constants'
import type {
  AccountStatus, Tier, CommitteeRole, ConnectionStatus, ConversationStage,
} from '@/lib/account-pursuit/types'

function Pill({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ value }: { value: AccountStatus }) {
  const s = styleFor(ACCOUNT_STATUSES, value)
  return <Pill label={s.label} cls={s.cls} />
}

export function TierBadge({ value }: { value: Tier | null }) {
  if (!value) return <span className="text-[11px] text-slate-400">—</span>
  const s = styleFor(TIERS, value)
  return <Pill label={s.label} cls={s.cls} />
}

export function RoleBadge({ value }: { value: CommitteeRole }) {
  const s = styleFor(COMMITTEE_ROLES, value)
  return <Pill label={s.label} cls={s.cls} />
}

export function ConnectionBadge({ value }: { value: ConnectionStatus }) {
  const s = styleFor(CONNECTION_STATUSES, value)
  return <Pill label={s.label} cls={s.cls} />
}

export function StageBadge({ value }: { value: ConversationStage }) {
  const s = styleFor(CONVERSATION_STAGES, value)
  return <Pill label={s.label} cls={s.cls} />
}
