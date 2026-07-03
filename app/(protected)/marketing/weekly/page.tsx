import { createClient } from '@/lib/supabase/server'
import { deriveTargets } from '@/lib/calculations'
import type { Settings, Segment, Channel, WeeklyActual, Lead } from '@/types'
import WeeklyReviewForm from '@/components/marketing/weekly/weekly-review-form'
import WeeklyTrend, { type WeekPoint } from '@/components/marketing/weekly/weekly-trend'
import { PageHero } from '@/components/marketing/ui/panel'
import { ClipboardList } from 'lucide-react'

const TREND_WEEKS = 10

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mondayOf(d: Date) {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
  return x
}
function shortLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function WeeklyReviewPage() {
  const supabase = await createClient()

  const [
    { data: settingsRows },
    { data: segments },
    { data: channels },
    { data: weeklyRows },
    { data: leadRows },
  ] = await Promise.all([
    supabase.from('marketing_settings').select('*').limit(1),
    supabase.from('segments').select('*').order('sort_order'),
    supabase.from('channels').select('*').order('sort_order'),
    supabase.from('weekly_actuals').select('*').order('week_start', { ascending: false }).limit(8),
    supabase.from('leads').select('lead_date, became_sql_date, lead_source, lead_status, assigned_to'),
  ])

  const settings = settingsRows?.[0] as Settings | undefined
  if (!settings) return <div className="flex items-center justify-center h-64 text-slate-400">Configure settings first.</div>

  const targets = deriveTargets(settings)
  const segs = (segments ?? []) as Segment[]
  const chs = (channels ?? []) as Channel[]
  const weeks = (weeklyRows ?? []) as WeeklyActual[]
  const leads = (leadRows ?? []) as Pick<Lead, 'lead_date' | 'became_sql_date' | 'lead_source' | 'lead_status' | 'assigned_to'>[]

  // ── Build last N Mon–Sun weeks and bucket achieved MQL/SQL from the leads ──
  const thisMonday = mondayOf(new Date())
  const trend: WeekPoint[] = Array.from({ length: TREND_WEEKS }, (_, idx) => {
    const i = TREND_WEEKS - 1 - idx // oldest → newest
    const start = new Date(thisMonday); start.setDate(thisMonday.getDate() - i * 7)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    const s = isoLocal(start), e = isoLocal(end)
    const inWeek = (d: string | null | undefined) => !!d && d >= s && d <= e
    const mql = leads.filter(l => l.lead_status === 'MQL' && inWeek(l.lead_date)).length
    const sql = leads.filter(l => l.lead_status === 'SQL' && inWeek(l.became_sql_date ?? l.lead_date)).length
    return { start: s, end: e, label: shortLabel(s), range: `${shortLabel(s)}–${shortLabel(e)}`, mql, sql }
  })

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1100px] mx-auto">
      <PageHero
        icon={ClipboardList}
        title="Weekly 1:1 Review"
        subtitle="Founder ↔ Marketing Head · Fill the highlighted fields before the review · Numbers first"
      />
      <WeeklyTrend series={trend} reqMql={targets.weekly_mqls} reqSql={targets.weekly_sqls} />
      <WeeklyReviewForm targets={targets} settings={settings} existingWeeks={weeks} leads={leads} />
    </div>
  )
}
