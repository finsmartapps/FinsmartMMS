export type LeadCategory = 'Digital MQL' | 'Direct SQL' | 'Event SQL' | 'Unclassified'

export const LEAD_SOURCES = [
  'Direct',
  'Organic',
  'Email',
  'Event',
  'Social Media',
  'Referral',
  'Paid Ads',
  'Chatbot',
  'Webinar',
  'Calling',
  'Channel Partner',
  'Sales Self Generated',
] as const

export const DIGITAL_MQL_SOURCES = ['Email', 'Social Media', 'Paid Ads', 'Chatbot', 'Webinar']
export const EVENT_SQL_SOURCES = ['Event']
export const DIRECT_SQL_SOURCES = ['Direct', 'Organic', 'Referral', 'Calling', 'Channel Partner', 'Sales Self Generated']

export function classifyLeadSource(source: string): LeadCategory {
  if (DIGITAL_MQL_SOURCES.includes(source)) return 'Digital MQL'
  if (EVENT_SQL_SOURCES.includes(source))   return 'Event SQL'
  if (DIRECT_SQL_SOURCES.includes(source))  return 'Direct SQL'
  return 'Unclassified'
}

export const CATEGORY_STYLES: Record<LeadCategory, { badge: string; dot: string }> = {
  'Digital MQL': { badge: 'bg-indigo-50 text-indigo-700 ring-indigo-100',   dot: 'bg-indigo-500' },
  'Direct SQL':  { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100', dot: 'bg-emerald-500' },
  'Event SQL':   { badge: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100', dot: 'bg-fuchsia-500' },
  'Unclassified':{ badge: 'bg-slate-100 text-slate-500 ring-slate-200',      dot: 'bg-slate-400' },
}

export const LEAD_FROM = ['Website', 'Cold Calling', 'Sales Email', 'Marketing Email', 'Social Media', 'Landing Page']

export const LEAD_STAGES = [
  'New',
  'Attempting',
  'Connected',
  'Qualified = Converted to Deal',
  'Near Closure',
  'Agreement Sent',
  'Closed Won',
  'Closed Lost',
  'Cold',
]

export const STAGE_STYLES: Record<string, string> = {
  'New':                          'bg-slate-100 text-slate-600',
  'Attempting':                   'bg-sky-50 text-sky-700',
  'Connected':                    'bg-blue-50 text-blue-700',
  'Qualified = Converted to Deal':'bg-indigo-50 text-indigo-700',
  'Near Closure':                 'bg-violet-50 text-violet-700',
  'Agreement Sent':               'bg-fuchsia-50 text-fuchsia-700',
  'Closed Won':                   'bg-emerald-50 text-emerald-700',
  'Closed Lost':                  'bg-rose-50 text-rose-700',
  'Cold':                         'bg-amber-50 text-amber-700',
}

export const LEAD_STATUSES = ['Lead', 'MQL', 'SQL', 'Opportunity', 'Customer', 'Existing Customer']

export const STATUS_STYLES: Record<string, string> = {
  'Lead':              'bg-slate-100 text-slate-600',
  'MQL':               'bg-indigo-50 text-indigo-700',
  'SQL':               'bg-emerald-50 text-emerald-700',
  'Opportunity':       'bg-violet-50 text-violet-700',
  'Customer':          'bg-fuchsia-50 text-fuchsia-700',
  'Existing Customer': 'bg-amber-50 text-amber-700',
}

export function normalizeStatus(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  const map: Record<string, string> = {
    'lead': 'Lead', 'mql': 'MQL', 'sql': 'SQL', 'opportunity': 'Opportunity',
    'customer': 'Customer', 'existing customer': 'Existing Customer',
  }
  return map[lower] ?? s
}

export function defaultStatusFromSource(source: string): string {
  const cat = classifyLeadSource(source)
  if (cat === 'Digital MQL') return 'MQL'
  if (cat === 'Direct SQL' || cat === 'Event SQL') return 'SQL'
  return ''
}

export const CUSTOMER_TYPES = ['NBNC', 'NBEC']

export const ASSIGNEE_SUGGESTIONS = ['Piyush', 'Maanoj Shah', 'Chirag Patel', 'Palak Pandey', 'Aaryan Yadav', 'SDR 3']

export const SQL_STAGES = ['Qualified = Converted to Deal', 'Near Closure', 'Agreement Sent', 'Closed Won']

export const HOURS_PER_SEAT = 160
export const CLOSED_WON_STAGE = 'Closed Won'

export function hoursToSeats(hours: number): number {
  const h = Number(hours) || 0
  return h / HOURS_PER_SEAT
}

export function formatSeats(seats: number): string {
  const s = Number(seats) || 0
  return Number.isInteger(s) ? s.toString() : s.toFixed(2).replace(/\.?0+$/, '')
}

export function annualContractValue(mrr: number, oneTime: number): number {
  return (Number(mrr) || 0) * 12 + (Number(oneTime) || 0)
}

export function isClosedWon(stage: string): boolean {
  return stage === CLOSED_WON_STAGE
}

export function formatUSD(value: number, withCents = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  }).format(Number(value) || 0)
}

export const FISCAL_START_MONTH = 4

export function fiscalYearStart(date: Date): number {
  return date.getMonth() >= FISCAL_START_MONTH - 1 ? date.getFullYear() : date.getFullYear() - 1
}

export function fiscalYearLabel(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

export function fiscalQuarter(date: Date): number {
  const m = date.getMonth() + 1
  return Math.floor(((m - FISCAL_START_MONTH + 12) % 12) / 3) + 1
}

export const FISCAL_MONTHS: { name: string; mm: string }[] = [
  { name: 'Apr', mm: '04' }, { name: 'May', mm: '05' }, { name: 'Jun', mm: '06' },
  { name: 'Jul', mm: '07' }, { name: 'Aug', mm: '08' }, { name: 'Sep', mm: '09' },
  { name: 'Oct', mm: '10' }, { name: 'Nov', mm: '11' }, { name: 'Dec', mm: '12' },
  { name: 'Jan', mm: '01' }, { name: 'Feb', mm: '02' }, { name: 'Mar', mm: '03' },
]

export const FISCAL_QUARTERS: { label: string; months: string[] }[] = [
  { label: 'Q1', months: ['04', '05', '06'] },
  { label: 'Q2', months: ['07', '08', '09'] },
  { label: 'Q3', months: ['10', '11', '12'] },
  { label: 'Q4', months: ['01', '02', '03'] },
]

export const IMPORT_COLUMNS = [
  'sr', 'lead_date', 'name', 'email', 'phone', 'website_url', 'company_name',
  'industry', 'service_required', 'data_source', 'lead_from', 'lead_source',
  'state', 'country', 'comment', 'assigned_to', 'lead_status', 'became_sql_date',
  'lead_stage', 'customer_type', 'closed_date', 'closed_hours', 'mrr_value',
  'one_time_revenue', 'seat_type', 'successful_meetings', 'loss_reason',
]

export function parseSheetDate(raw: string): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, mo, d] = s.split('-')
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

export function parseDelimitedLine(line: string, delim: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      cells.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}
