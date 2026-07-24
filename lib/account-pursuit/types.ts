// ── Account Pursuit (ABM) types — mirror supabase abm_* tables ──

export type AccountStatus =
  | 'target' | 'engaged' | 'in_conversation' | 'opportunity' | 'won' | 'lost' | 'on_hold'

export type Tier = 'A' | 'B' | 'C'

export type CommitteeRole =
  | 'decision_maker' | 'champion' | 'influencer' | 'gatekeeper' | 'unknown'

export type ConnectionStatus =
  | 'not_sent' | 'request_sent' | 'accepted' | 'no_response' | 'declined'

export type ConversationStage =
  | 'no_contact' | 'opener_sent' | 'replied' | 'in_conversation' | 'meeting_booked' | 'cold'

export type Channel = 'connect_note' | 'dm' | 'inmail' | 'email'
export type Direction = 'sent' | 'received'

export interface WarmConnection {
  first_name: string
  last_name: string
  position: string
  url: string
  company: string
}

export interface AbmAccount {
  id: string
  name: string
  website: string | null
  linkedin_url: string | null
  industry: string | null
  targeted_industry: string | null
  revenue_text: string | null
  revenue_usd: number | null
  employee_size: number | null
  tier: Tier | null
  fit_score: number | null
  status: AccountStatus
  compelling_event: string | null
  pain_hypothesis: string | null
  state: string | null
  country: string | null
  address: string | null
  associations: string | null
  software_partnerships: string | null
  offshore_presence: string | null
  other_industries: string | null
  next_action: string | null
  next_action_date: string | null
  owner_id: string | null
  source: string | null
  notes: string | null
  last_activity_at: string | null
  stage_changed_at: string | null
  closed_at: string | null
  loss_reason: string | null
  warm_connection_count: number
  warm_connections: WarmConnection[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AbmContact {
  id: string
  account_id: string
  first_name: string
  last_name: string | null
  job_title: string | null
  committee_role: CommitteeRole
  linkedin_url: string | null
  email: string | null
  office_number: string | null
  direct_number: string | null
  mutual_connections: string | null
  has_mutuals: boolean
  connection_status: ConnectionStatus
  request_sent_at: string | null
  connected_at: string | null
  conversation_stage: ConversationStage
  next_action: string | null
  next_action_date: string | null
  last_touch_at: string | null
  touch_count: number
  do_not_contact: boolean
  owner_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AbmMessage {
  id: string
  contact_id: string
  account_id: string | null
  direction: Direction
  channel: Channel
  body: string
  template_id: string | null
  occurred_at: string
  logged_by: string | null
  created_at: string
}

export interface AbmTemplate {
  id: string
  name: string
  body: string
  channel: Channel | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
