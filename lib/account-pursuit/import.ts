import { parseRevenue, autoTier, guessRole } from './helpers'
import type { CommitteeRole } from './types'

// ── Cell cleaning ───────────────────────────────────────────────────────────
// Trim, collapse internal newlines, strip the U+FFFD replacement char (mojibake),
// and treat '-' / '' as empty.
export function clean(v: unknown): string | null {
  if (v == null) return null
  let s = String(v).replace(/�/g, '').replace(/\s+/g, ' ').trim()
  if (s === '' || s === '-' || s === '—') return null
  return s
}

function cleanUrl(v: unknown): string | null {
  const s = clean(v)
  if (!s) return null
  return s.replace(/\s+/g, '')
}

function toInt(v: unknown): number | null {
  const s = clean(v)
  if (!s) return null
  const n = parseInt(s.replace(/[^\d]/g, ''), 10)
  return Number.isNaN(n) ? null : n
}

// ── Header matching (order-independent, tolerant of spacing/typos) ────────────
type HeaderMap = Record<string, number>

function normHeader(h: unknown): string {
  return String(h ?? '').replace(/�/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

// Map of our field → list of accepted normalized header spellings.
const FIELD_HEADERS: Record<string, string[]> = {
  company_name:       ['companyname'],
  company_industry:   ['companyindustry'],
  targeted_industry:  ['targetedindustry'],
  revenue:            ['revenue'],
  employee_size:      ['employeesize'],
  first_name:         ['firstname'],
  last_name:          ['lastname'],
  job_title:          ['jobtitle'],
  office_number:      ['officenumber'],
  direct_number:      ['directnumber'],
  email:              ['emailaddress', 'email'],
  linkedin:           ['contactslinkedin', 'linkedin', 'contactlinkedin'],
  common_connection:  ['commonconnection', 'commonconnections'],
  website:            ['website'],
  address:            ['address'],
  state:              ['state'],
  country:            ['country'],
  associations:       ['associatedassociation', 'associatedassociations'],
  software:           ['partnershipwithsoftware'],
  other_industries:   ['otherindustrytheycater', 'otherindustriestheycater'],
  offshore:           ['offshorepresene', 'offshorepresence'],
}

export function buildHeaderMap(headerRow: unknown[]): HeaderMap {
  const norm = headerRow.map(normHeader)
  const map: HeaderMap = {}
  for (const [field, spellings] of Object.entries(FIELD_HEADERS)) {
    const idx = norm.findIndex(h => spellings.includes(h))
    if (idx >= 0) map[field] = idx
  }
  return map
}

// ── Parsed shapes ─────────────────────────────────────────────────────────────
export interface ParsedContact {
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
}

export interface ParsedAccount {
  name: string
  website: string | null
  industry: string | null
  targeted_industry: string | null
  revenue_text: string | null
  revenue_usd: number | null
  employee_size: number | null
  tier: 'A' | 'B' | 'C'
  state: string | null
  country: string | null
  address: string | null
  associations: string | null
  software_partnerships: string | null
  offshore_presence: string | null
  other_industries: string | null
  contacts: ParsedContact[]
}

const NO_WARM = /^(no( known)? mutuals?|none|shows page|n\/a)/i

// Group data rows (as arrays) into accounts + nested contacts.
export function parseRows(rows: unknown[][], map: HeaderMap): ParsedAccount[] {
  const get = (row: unknown[], field: string) => (field in map ? row[map[field]] : undefined)
  const byName = new Map<string, ParsedAccount>()

  for (const row of rows) {
    const name = clean(get(row, 'company_name'))
    const first = clean(get(row, 'first_name'))
    if (!name && !first) continue // skip blank rows

    const key = (name ?? '').toLowerCase()
    if (name && !byName.has(key)) {
      const revenue_text = clean(get(row, 'revenue'))
      const revenue_usd = parseRevenue(revenue_text)
      const employees = toInt(get(row, 'employee_size'))
      byName.set(key, {
        name,
        website: cleanUrl(get(row, 'website')),
        industry: clean(get(row, 'company_industry')),
        targeted_industry: clean(get(row, 'targeted_industry')),
        revenue_text,
        revenue_usd,
        employee_size: employees,
        tier: autoTier(revenue_usd, employees),
        state: clean(get(row, 'state')),
        country: clean(get(row, 'country')),
        address: clean(get(row, 'address')),
        associations: clean(get(row, 'associations')),
        software_partnerships: clean(get(row, 'software')),
        offshore_presence: clean(get(row, 'offshore')),
        other_industries: clean(get(row, 'other_industries')),
        contacts: [],
      })
    }

    const acct = name ? byName.get(key)! : undefined
    if (acct && first) {
      const mutual = clean(get(row, 'common_connection'))
      acct.contacts.push({
        first_name: first,
        last_name: clean(get(row, 'last_name')),
        job_title: clean(get(row, 'job_title')),
        committee_role: guessRole(clean(get(row, 'job_title'))),
        linkedin_url: cleanUrl(get(row, 'linkedin')),
        email: clean(get(row, 'email')),
        office_number: clean(get(row, 'office_number')),
        direct_number: clean(get(row, 'direct_number')),
        mutual_connections: mutual,
        has_mutuals: !!mutual && !NO_WARM.test(mutual),
      })
    }
  }

  return [...byName.values()]
}
