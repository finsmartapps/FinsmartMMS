export type Role = 'manager' | 'telecaller'

// ── LinkedIn Module ───────────────────────────────────────────────────────────
export type LinkedInContactStatus = 'queued' | 'request_sent'

export interface LinkedInContact {
  id: string
  assigned_to: string | null
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  job_title: string | null
  linkedin_url: string | null
  lead_source: string | null
  city: string | null
  country: string | null
  status: LinkedInContactStatus
  queue_date: string | null
  request_sent_at: string | null
  generated_message: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  name: string
  description: string | null
  is_active: boolean
  display_order: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface Target {
  id: string
  user_id: string
  activity_id: string
  min_value: number
  effective_from: string
  created_by: string
  created_at: string
}

export interface DailyLog {
  id: string
  user_id: string
  log_date: string
  is_submitted: boolean
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface DailyLogEntry {
  id: string
  log_id: string
  activity_id: string
  value: number
  deficit_reason: string | null
  created_at: string
  updated_at: string
}

export interface Holiday {
  id: string
  holiday_date: string
  label: string
  created_by: string
  created_at: string
}

export interface EntryWithMeta extends DailyLogEntry {
  activity: Activity
  target: number
}

export type MeetingTimezone = 'IST' | 'EST' | 'PST' | 'CST' | 'MT'

export const TIMEZONES: { value: MeetingTimezone; label: string }[] = [
  { value: 'IST', label: 'IST — India Standard Time' },
  { value: 'EST', label: 'EST — Eastern Standard Time' },
  { value: 'PST', label: 'PST — Pacific Standard Time' },
  { value: 'CST', label: 'CST — Central Standard Time' },
  { value: 'MT',  label: 'MT — Mountain Time' },
]

export const COMPANY_SIZES = [
  '1–10',
  '11–50',
  '51–200',
  '201–500',
  '501–1000',
  '1000+',
]

export type MeetingOutcome = 'completed' | 'cancelled' | 'rescheduled'
export type MeetingResult = 'converted_opportunity' | 'future_followup' | 'lost'

export interface Meeting {
  id: string
  user_id: string
  first_name: string
  last_name: string
  company_name: string
  company_size: string | null
  meeting_date: string
  meeting_time: string
  timezone: MeetingTimezone
  lead_source: string | null
  notes: string | null
  outcome: MeetingOutcome | null
  result: MeetingResult | null
  created_at: string
}

export interface LinkedInContactActivity {
  id: string
  contact_id: string
  user_id: string
  action: 'status_changed' | 'fields_updated' | 'message_generated' | 'note_added'
  detail: string | null
  created_at: string
}

export type FollowUpStatus = 'pending' | 'done'

export interface FollowUp {
  id: string
  user_id: string
  first_name: string
  last_name: string
  company_name: string | null
  phone: string | null
  email: string | null
  follow_up_date: string
  notes: string | null
  status: FollowUpStatus
  created_at: string
  updated_at: string
}

// ── Advocacy Module ───────────────────────────────────────────────────────────
export type MissionType = 'follow' | 'like' | 'comment' | 'share' | 'original_post'
export type MissionStatus = 'draft' | 'active' | 'ended'

export interface AdvocacyMission {
  id: string
  title: string
  type: MissionType
  description: string | null
  post_copy: string | null
  linkedin_url: string | null
  points: number
  deadline: string | null
  status: MissionStatus
  created_by: string | null
  created_at: string
}

export const MISSION_POINTS: Record<MissionType, number> = {
  follow:        5,
  like:          2,
  comment:       5,
  share:         10,
  original_post: 15,
}
