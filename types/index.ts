// Unified profile — one row per user in the system
export interface Profile {
  id: string
  name: string
  email: string
  role: 'manager' | 'telecaller' | null
  has_sales: boolean
  has_marketing: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserModules {
  sales: boolean
  marketing: boolean
}

// ── Marketing Module Types ────────────────────────────────────────────────────

export interface Settings {
  id: string
  annual_seats_target: number
  avg_deal_value: number
  sql_seat_conversion: number
  event_sql_target: number
  digital_mql_sql_conversion: number
  meeting_sql_conversion: number
  updated_at: string
}

export interface Segment {
  id: string
  name: string
  annual_seats_target: number
  avg_deal_value: number
  primary_channel: string
  sort_order: number
}

export interface Channel {
  id: string
  name: string
  monthly_mql_target: number
  mql_sql_conversion: number
  planning_notes: string
  owner_role: string
  sort_order: number
}

export interface PlanEvent {
  id: string
  name: string
  quarter: string
  sql_target_min: number
  sql_target_max: number
  meetings_target: number
  primary_segment: string
  owner_role: string
  notes: string
  sort_order: number
}

export interface ChannelSnapshot {
  channel_name: string
  weekly_mql: number
  weekly_sql: number
  what_moved: string
  what_broke: string
  action_next_week: string
}

export interface SegmentPerformance {
  segment_name: string
  actual_sql: number
  mtd_sql: number
  seats_closed_mtd: number
  notes: string
}

export interface SDRProductivity {
  sdr_name: string
  meetings_booked: number
  show_rate: number
  meeting_sql_rate: number
}

export interface WeeklyActual {
  id: string
  week_start: string
  week_end: string
  mql_actual: number
  sql_actual: number
  meetings_actual: number
  pipeline_created: number
  wins: string
  concerns: string
  decisions_needed: string
  founder_support: string
  channel_snapshot: ChannelSnapshot[]
  segment_performance: SegmentPerformance[]
  sdr_productivity: SDRProductivity[]
  submitted_by: string
  submitted_at: string
  updated_at: string
}

export interface MonthlyChannelData {
  channel_id: string
  channel_name: string
  mql_actual: number
  sql_actual: number
}

export interface MonthlySegmentData {
  segment_id: string
  segment_name: string
  sql_actual: number
  seats_closed: number
}

export interface MonthlyEventData {
  event_id: string
  event_name: string
  sqls_actual: number
  deals_closed: number
  event_cost: number
}

export interface MonthlyActual {
  id: string
  month: string
  seats_closed: number
  channel_data: MonthlyChannelData[]
  segment_data: MonthlySegmentData[]
  event_data: MonthlyEventData[]
  pipeline_30d_closures: number
  pipeline_30d_sqls: number
  pipeline_30d_value: number
  pipeline_60d_closures: number
  pipeline_60d_sqls: number
  pipeline_60d_value: number
  pipeline_90d_closures: number
  pipeline_90d_sqls: number
  pipeline_90d_value: number
  top_wins: string
  top_blockers: string
  big_experiment: string
  founder_support_needed: string
  submitted_by: string
  submitted_at: string
  updated_at: string
}

export interface Lead {
  id: string
  sr_no: number
  lead_date: string
  name: string
  email: string
  phone: string
  website_url: string
  company_name: string
  industry: string
  service_required: string
  data_source: string
  lead_from: string
  lead_source: string
  state: string
  country: string
  comment: string
  assigned_to: string
  lead_status: string
  became_sql_date: string | null
  lead_stage: string
  customer_type: string
  category: string
  closed_hours: number | null
  mrr_value: number | null
  one_time_revenue: number | null
  seat_type: string
  successful_meetings: boolean
  loss_reason: string | null
  closed_date: string | null
  created_at: string
  updated_at: string
}

export interface DerivedTargets {
  monthly_seats: number
  monthly_arr: number
  annual_arr: number
  annual_sqls: number
  monthly_sqls: number
  event_sqls: number
  digital_sqls: number
  monthly_digital_sqls: number
  digital_mqls: number
  monthly_mqls: number
  digital_meetings: number
  monthly_meetings: number
  weekly_mqls: number
  weekly_sqls: number
  weekly_meetings: number
}
