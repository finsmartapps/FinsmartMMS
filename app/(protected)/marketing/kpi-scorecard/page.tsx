import { createClient } from '@/lib/supabase/server'
import { deriveTargets, formatCurrency, formatPercent } from '@/lib/calculations'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/marketing/ui/table'
import { Panel, Th, Pill, PageHero } from '@/components/marketing/ui/panel'
import { DonutChart } from '@/components/marketing/charts/dashboard-charts'
import type { Settings, Segment } from '@/types'
import { BarChart2, Target, Users, HelpCircle, Clock, Zap, PieChart } from 'lucide-react'

const KPI_WEIGHTS = [
  { kra: 'Pipeline creation',       weight: 30, kpi: 'SQLs + pipeline created',                      cadence: 'Weekly / Monthly', success: 'Delivers annual SQL target with healthy channel mix',    bar: 'from-indigo-500 to-violet-500' },
  { kra: 'Revenue contribution',    weight: 30, kpi: 'Seats closed from marketing-sourced pipeline',  cadence: 'Monthly',          success: 'Tracks toward 100-seat North Star',                     bar: 'from-violet-500 to-fuchsia-500' },
  { kra: 'Conversion efficiency',   weight: 15, kpi: 'MQL→SQL and Meeting→SQL',                       cadence: 'Weekly',           success: 'Conversion holds at or above benchmarks',               bar: 'from-fuchsia-500 to-pink-500' },
  { kra: 'Content & GTM alignment', weight: 15, kpi: 'Monthly theme and campaign alignment',          cadence: 'Monthly',          success: 'No fragmented execution; all channels aligned',         bar: 'from-emerald-500 to-teal-500' },
  { kra: 'Team management',         weight: 5,  kpi: 'Onboarding, cadence, accountability',           cadence: 'Monthly',          success: 'Strong execution rhythm across team',                   bar: 'from-amber-500 to-orange-500' },
  { kra: 'Talent marketing',        weight: 5,  kpi: 'Employer brand support',                        cadence: 'Monthly',          success: 'Supports hiring and brand pull where needed',           bar: 'from-sky-500 to-cyan-500' },
]

const FOUNDER_QUESTIONS = [
  { q: 'Do we have a clear annual, quarterly, and monthly marketing plan?',     icon: '📋' },
  { q: 'Is the monthly content theme translating into SQLs, not just activity?', icon: '📈' },
  { q: 'Is digital improving enough, or are we over-relying on events?',         icon: '⚡' },
  { q: 'Are new team members onboarded with a clear 30-day output plan?',        icon: '👥' },
  { q: 'Are you spending time on high-impact work vs. operational tasks?',       icon: '🎯' },
]

export default async function KPIScorecardPage() {
  const supabase = await createClient()
  const [{ data: settingsRows }, { data: segments }] = await Promise.all([
    supabase.from('marketing_settings').select('*').limit(1),
    supabase.from('segments').select('*').order('sort_order'),
  ])

  const settings = settingsRows?.[0] as Settings | undefined
  if (!settings) return <div className="flex items-center justify-center h-64 text-slate-400">Configure settings first.</div>

  const targets = deriveTargets(settings)
  const segs = (segments ?? []) as Segment[]
  const segmentSql = segs.map(s => ({
    name: s.name,
    value: s.annual_seats_target > 0 ? Math.ceil(s.annual_seats_target / settings.sql_seat_conversion) : 0,
  }))

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Hero ── */}
      <PageHero
        icon={BarChart2}
        title="KPI Scorecard"
        subtitle="Annual KRAs, KPI weightage, and measurable outcomes aligned to the 100-seat North Star"
      />

      {/* ── Weekly target stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'MQLs / week',     value: targets.weekly_mqls,     grad: 'from-indigo-500 to-violet-600',   glow: 'glow-indigo' },
          { label: 'SQLs / week',      value: targets.weekly_sqls,     grad: 'from-violet-500 to-fuchsia-600',  glow: 'glow-violet' },
          { label: 'Meetings / week',  value: targets.weekly_meetings, grad: 'from-emerald-500 to-teal-600',    glow: 'glow-emerald' },
        ].map(item => (
          <div key={item.label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.grad} p-5 hover-lift ${item.glow}`}>
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" aria-hidden />
            <p className="relative text-4xl font-extrabold text-white tabular-nums leading-none">{item.value}</p>
            <p className="relative text-[11px] font-bold text-white/75 uppercase tracking-widest mt-2">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business targets */}
        <Panel icon={Target} title="Business Targets & Assumptions" accent="indigo" noPad>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
                <Th className="pl-5">Metric</Th>
                <Th right>Annual</Th>
                <Th right className="pr-5">Monthly</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: 'Annual seats target',      ann: settings.annual_seats_target,                        mo: (settings.annual_seats_target / 12).toFixed(1),  note: 'North Star',     hl: false },
                { label: 'Average deal value',        ann: formatCurrency(settings.avg_deal_value),             mo: '—',                                             note: 'Per seat',       hl: false },
                { label: 'New ARR target',            ann: formatCurrency(targets.annual_arr),                  mo: formatCurrency(targets.monthly_arr),             note: 'Seats × deal',   hl: true  },
                { label: 'SQL → seat conversion',     ann: formatPercent(settings.sql_seat_conversion),         mo: '—',                                             note: 'Close rate',     hl: false },
                { label: 'Required annual SQLs',      ann: targets.annual_sqls,                                 mo: targets.monthly_sqls.toFixed(1),                 note: 'Primary score',  hl: true  },
                { label: 'Event SQL target',          ann: targets.event_sqls,                                  mo: (targets.event_sqls / 12).toFixed(1),            note: 'Conferences',    hl: false },
                { label: 'Digital SQL target',        ann: targets.digital_sqls,                                mo: targets.monthly_digital_sqls.toFixed(1),         note: 'Digital + SDR',  hl: false },
                { label: 'Digital MQL→SQL conv.',     ann: formatPercent(settings.digital_mql_sql_conversion), mo: '—',                                             note: 'Blended',        hl: false },
                { label: 'Required digital MQLs',     ann: targets.digital_mqls,                                mo: targets.monthly_mqls.toFixed(1),                 note: 'For digital SQLs', hl: true },
                { label: 'Meeting→SQL conversion',    ann: formatPercent(settings.meeting_sql_conversion),      mo: '—',                                             note: 'SDR meetings',   hl: false },
                { label: 'Required digital meetings', ann: targets.digital_meetings,                            mo: targets.monthly_meetings.toFixed(1),             note: 'SDR + outbound', hl: false },
              ].map((row, i) => (
                <TableRow key={i} className={`hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-0 ${row.hl ? 'bg-indigo-50/40' : ''}`}>
                  <TableCell className={`py-2.5 pl-5 ${row.hl ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
                    {row.label}<span className="ml-2 text-[10px] text-slate-400 font-normal">{row.note}</span>
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${row.hl ? 'font-extrabold text-indigo-700' : 'text-slate-700'}`}>{row.ann}</TableCell>
                  <TableCell className={`text-right tabular-nums pr-5 ${row.hl ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{row.mo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <div className="space-y-6">
          {/* SQL by segment donut */}
          <Panel icon={PieChart} title="SQLs Needed by Segment" accent="violet">
            <div className="pt-2">
              <DonutChart
                data={segmentSql}
                centerValue={targets.annual_sqls.toString()}
                centerLabel="Total SQLs"
              />
            </div>
          </Panel>

          {/* Founder questions */}
          <Panel icon={HelpCircle} title="Founder Review Questions" accent="amber">
            <div className="space-y-2 pt-1">
              {FOUNDER_QUESTIONS.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-amber-50/50 transition-colors">
                  <span className="text-base shrink-0">{item.icon}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{item.q}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* ── Segment SQL targets table ── */}
      <Panel icon={Users} title="Segment SQL Targets" accent="emerald" noPad>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
              <Th className="pl-5">Segment</Th>
              <Th right>Annual Seats</Th>
              <Th right>SQLs Needed</Th>
              <Th right>Monthly SQL</Th>
              <Th right>Avg Deal</Th>
              <Th right className="pr-5">ARR</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {segs.map(seg => {
              const sqls = seg.annual_seats_target > 0 ? Math.ceil(seg.annual_seats_target / settings.sql_seat_conversion) : 0
              return (
                <TableRow key={seg.id} className="hover:bg-emerald-50/30 transition-colors border-b border-slate-50 last:border-0">
                  <TableCell className="font-semibold text-slate-800 py-3.5 pl-5">{seg.name}</TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{seg.annual_seats_target}</TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{sqls || '—'}</TableCell>
                  <TableCell className="text-right"><Pill>{sqls ? Math.ceil(sqls / 12) : '—'}</Pill></TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{formatCurrency(seg.avg_deal_value)}/mo</TableCell>
                  <TableCell className="text-right font-bold text-slate-800 tabular-nums pr-5">{formatCurrency(seg.annual_seats_target * seg.avg_deal_value * 12)}</TableCell>
                </TableRow>
              )
            })}
            <TableRow className="bg-gradient-to-r from-emerald-50 to-teal-50 font-bold border-t-2 border-emerald-100">
              <TableCell className="text-slate-900 py-3.5 pl-5">Total</TableCell>
              <TableCell className="text-right text-slate-700 tabular-nums">{settings.annual_seats_target}</TableCell>
              <TableCell className="text-right text-slate-700 tabular-nums">{targets.annual_sqls}</TableCell>
              <TableCell className="text-right"><Pill strong>{Math.round(targets.monthly_sqls)}</Pill></TableCell>
              <TableCell />
              <TableCell className="text-right text-emerald-700 tabular-nums pr-5">{formatCurrency(segs.reduce((s, seg) => s + seg.annual_seats_target * seg.avg_deal_value * 12, 0))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Panel>

      {/* ── KPI weightage ── */}
      <Panel icon={Zap} title="KPI Weightage" accent="fuchsia" noPad>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
              <Th className="pl-5">KRA</Th>
              <Th>Weight</Th>
              <Th>Primary KPI</Th>
              <Th>Cadence</Th>
              <Th className="pr-5">Success Definition</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {KPI_WEIGHTS.map(row => (
              <TableRow key={row.kra} className="hover:bg-fuchsia-50/20 transition-colors border-b border-slate-50 last:border-0">
                <TableCell className="font-semibold text-slate-800 py-3.5 pl-5">{row.kra}</TableCell>
                <TableCell className="w-44">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${row.bar}`} style={{ width: `${row.weight * 2}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 tabular-nums w-8">{row.weight}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-700">{row.kpi}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-full px-2.5 py-0.5">
                    <Clock className="h-3 w-3" /> {row.cadence}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-slate-500 pr-5">{row.success}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  )
}
