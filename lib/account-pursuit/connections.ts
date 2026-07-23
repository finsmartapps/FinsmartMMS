// Parse a LinkedIn "Connections" export (Settings → Get a copy of your data).
// The CSV has a few preamble/note lines before the real header row:
//   First Name, Last Name, URL, Email Address, Company, Position, Connected On

export interface ConnectionRow {
  first: string
  last: string
  url: string
  company: string
  position: string
  connectedOn: string | null // YYYY-MM-DD
}

// Reduce any LinkedIn profile URL to a stable key: "in/<slug>".
export function normalizeLinkedinUrl(u: string | null | undefined): string | null {
  if (!u) return null
  const s = String(u).toLowerCase().trim().replace(/\?.*$/, '').replace(/#.*$/, '')
  if (!s) return null
  const m = s.match(/linkedin\.com\/(in\/[^/]+)/)
  if (m) return m[1]
  return s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
}

function normKey(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')
}

function parseConnectedOn(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

// rows = array-of-arrays (from SheetJS sheet_to_json header:1 on the CSV).
export function parseConnectionRows(rows: unknown[][]): { rows: ConnectionRow[]; error?: string } {
  // Find the header row: the one containing first name + connected on (+ usually url).
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const keys = (rows[i] ?? []).map(normKey)
    if (keys.includes('firstname') && keys.includes('connectedon')) { headerIdx = i; break }
  }
  if (headerIdx < 0) return { rows: [], error: 'This does not look like a LinkedIn Connections export (no "First Name"/"Connected On" header found).' }

  const hdr = (rows[headerIdx] ?? []).map(normKey)
  const col = (k: string) => hdr.indexOf(k)
  const iFirst = col('firstname'), iLast = col('lastname'), iUrl = col('url')
  const iCompany = col('company'), iPos = col('position'), iConn = col('connectedon')

  const out: ConnectionRow[] = []
  for (const r of rows.slice(headerIdx + 1)) {
    const first = String(r[iFirst] ?? '').trim()
    const last = String(r[iLast] ?? '').trim()
    if (!first && !last) continue
    out.push({
      first, last,
      url: iUrl >= 0 ? String(r[iUrl] ?? '').trim() : '',
      company: iCompany >= 0 ? String(r[iCompany] ?? '').trim() : '',
      position: iPos >= 0 ? String(r[iPos] ?? '').trim() : '',
      connectedOn: iConn >= 0 ? parseConnectedOn(r[iConn]) : null,
    })
  }
  return { rows: out }
}

// Name+company fallback key.
export function nameCompanyKey(first: string, last: string, company: string): string {
  return `${first} ${last}`.toLowerCase().trim().replace(/\s+/g, ' ') + '|' + company.toLowerCase().trim()
}
