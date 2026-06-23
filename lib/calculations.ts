import type { Settings, DerivedTargets, Segment, Channel } from '@/types'

export function deriveTargets(s: Settings): DerivedTargets {
  const annual_sqls = Math.ceil(s.annual_seats_target / s.sql_seat_conversion)
  const event_sqls = s.event_sql_target
  const digital_sqls = annual_sqls - event_sqls
  const digital_mqls = Math.ceil(digital_sqls / s.digital_mql_sql_conversion)
  const digital_meetings = Math.ceil(digital_sqls / s.meeting_sql_conversion)

  return {
    monthly_seats: s.annual_seats_target / 12,
    monthly_arr: (s.annual_seats_target / 12) * s.avg_deal_value * 12,
    annual_arr: s.annual_seats_target * s.avg_deal_value * 12,
    annual_sqls,
    monthly_sqls: annual_sqls / 12,
    event_sqls,
    digital_sqls,
    monthly_digital_sqls: digital_sqls / 12,
    digital_mqls,
    monthly_mqls: digital_mqls / 12,
    digital_meetings,
    monthly_meetings: digital_meetings / 12,
    weekly_mqls: Math.ceil(digital_mqls / 12 / 4),
    weekly_sqls: Math.ceil(annual_sqls / 12 / 4),
    weekly_meetings: Math.ceil(digital_meetings / 12 / 4),
  }
}

export function segmentSQLs(seats: number, conversion: number): number {
  if (conversion === 0) return 0
  return Math.ceil(seats / conversion)
}

export function segmentARR(seats: number, dealValue: number): number {
  return seats * dealValue * 12
}

export function channelAnnualSQL(monthlyMQL: number, conversion: number): number {
  return Math.round(monthlyMQL * conversion * 12)
}

export function getStatus(actual: number, target: number): 'On Track' | 'Watch' {
  return actual >= target * 3 ? 'On Track' : 'Watch'
}

export function safeRate(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return numerator / denominator
}

export function eventROI(revenue: number, cost: number): number {
  if (!cost) return 0
  return revenue / cost
}

export function pipelineCoverage(pipelineValue: number, monthlyARR: number): number {
  if (!monthlyARR) return 0
  return pipelineValue / monthlyARR
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(decimals)
}

export function segmentTableRows(segments: Segment[], settings: Settings) {
  return segments.map(seg => ({
    ...seg,
    sqls_needed: segmentSQLs(seg.annual_seats_target, settings.sql_seat_conversion),
    monthly_sql: Math.ceil(segmentSQLs(seg.annual_seats_target, settings.sql_seat_conversion) / 12),
    arr: segmentARR(seg.annual_seats_target, seg.avg_deal_value),
  }))
}

export function channelTableRows(channels: Channel[]) {
  return channels.map(ch => ({
    ...ch,
    monthly_sql_output: ch.monthly_mql_target * ch.mql_sql_conversion,
    annual_mql: ch.monthly_mql_target * 12,
    annual_sql: channelAnnualSQL(ch.monthly_mql_target, ch.mql_sql_conversion),
  }))
}
