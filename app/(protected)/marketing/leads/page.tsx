import { createClient } from '@/lib/supabase/server'
import { deriveTargets } from '@/lib/calculations'
import { Panel, PageHero } from '@/components/marketing/ui/panel'
import { DonutChart, HBarChart } from '@/components/marketing/charts/dashboard-charts'
import AddLeadForm from '@/components/marketing/leads/add-lead-form'
import ImportLeads from '@/components/marketing/leads/import-leads'
import LeadsTable from '@/components/marketing/leads/leads-table'
import DraggableLeadCards from '@/components/marketing/leads/draggable-lead-cards'
import DraggableChartCards from '@/components/marketing/leads/draggable-chart-cards'
import PageSortableLayout from '@/components/marketing/leads/page-sortable-layout'
import SeatsSection from '@/components/marketing/leads/seats-section'
import LeadsFunnelSection from '@/components/marketing/leads/leads-funnel-section'
import ClosedWonBySource from '@/components/marketing/leads/closed-won-by-source'
import {
  classifyLeadSource, CATEGORY_STYLES,
  DIGITAL_MQL_SOURCES, EVENT_SQL_SOURCES, DIRECT_SQL_SOURCES, LEAD_STAGES,
  ASSIGNEE_SUGGESTIONS,
} from '@/lib/leads'
import type { Settings, Lead } from '@/types'
import {
  Zap, Layers, BookOpen, Inbox, ArrowUpRight,
  Armchair, Database, CalendarCheck, Trophy,
} from 'lucide-react'

export default async function LeadsPage() {
  const supabase = await createClient()
  const [{ data: settingsRows }, { data: leadRows }] = await Promise.all([
    supabase.from('marketing_settings').select('*').limit(1),
    supabase.from('leads').select('*').order('sr_no', { ascending: false }),
  ])

  const settings = settingsRows?.[0] as Settings | undefined
  const targets = settings ? deriveTargets(settings) : null
  const leads = (leadRows ?? []) as Lead[]

  // ── status-based rollup (matches Excel pivot) ──
  const mqlCount               = leads.filter(l => l.lead_status === 'MQL').length
  const sqlCount               = leads.filter(l => l.lead_status === 'SQL').length
  const successfulMeetingsCount = leads.filter(l => l.successful_meetings).length
  const opportunityCount = leads.filter(l => l.lead_status === 'Opportunity').length
  const isClosedBiz     = (l: Lead) => l.lead_stage === 'Closed Won' || (l.lead_status === 'SQL' && ((l.mrr_value ?? 0) > 0 || (l.one_time_revenue ?? 0) > 0))
  const customers       = leads.filter(isClosedBiz)

  // ── source-based classification (for charts / legend) ──
  const withCat = leads.map(l => ({ ...l, cat: classifyLeadSource(l.lead_source) }))
  const digitalMql = withCat.filter(l => l.cat === 'Digital MQL').length
  const directSql  = withCat.filter(l => l.cat === 'Direct SQL').length
  const eventSql   = withCat.filter(l => l.cat === 'Event SQL').length
  const totalSql   = directSql + eventSql

  // ── chart data ──
  const successfulMeetingLeads = leads.filter(l => l.successful_meetings)
  const bySourceSuccessful = Object.entries(
    successfulMeetingLeads.reduce<Record<string, number>>((acc, l) => {
      const k = l.lead_source || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const sqlLeads = leads.filter(l => l.lead_status === 'SQL')
  const closedWonLeads = leads.filter(l => l.lead_stage === 'Closed Won')

  const byLeadFromSuccessful = Object.entries(
    successfulMeetingLeads.reduce<Record<string, number>>((acc, l) => {
      const k = l.lead_from || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const bySourceSQL = Object.entries(
    sqlLeads.reduce<Record<string, number>>((acc, l) => {
      const k = l.lead_source || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const bySourceClosedWon = Object.entries(
    closedWonLeads.reduce<Record<string, number>>((acc, l) => {
      const k = l.lead_source || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const bySource = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const k = l.lead_source || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const byStage = LEAD_STAGES
    .map(stage => ({ name: stage.replace(' = Converted to Deal', ''), value: leads.filter(l => l.lead_stage === stage).length }))
    .filter(d => d.value > 0)

  // leads grouped by Data Source (free-text) — top 10 + "Other" tail
  const byDataSourceAll = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const k = l.data_source?.trim() || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const DS_TOP = 10
  const byDataSource = byDataSourceAll.length > DS_TOP
    ? [...byDataSourceAll.slice(0, DS_TOP), { name: `Other (${byDataSourceAll.length - DS_TOP})`, value: byDataSourceAll.slice(DS_TOP).reduce((s, d) => s + d.value, 0) }]
    : byDataSourceAll

  const seatsTarget = settings?.annual_seats_target ?? 100
  const won = leads.filter(isClosedBiz)

  // ── autocomplete suggestions ──
  const distinct = (key: keyof Lead) => Array.from(new Set(leads.map(l => (l[key] as string)).filter(Boolean))).sort()
  const existingEmails = leads.map(l => (l.email || '').trim().toLowerCase()).filter(Boolean)
  const dataSourceSuggestions = distinct('data_source')
  const industrySuggestions = distinct('industry')
  const serviceSuggestions = distinct('service_required')
  const assigneeSuggestions = Array.from(new Set([...ASSIGNEE_SUGGESTIONS, ...distinct('assigned_to')]))

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1400px] mx-auto">

      <PageHero
        icon={Inbox}
        title="Leads"
        subtitle="Add leads here — each one auto-associates to the funnel based on its Lead Source"
        action={
          <div className="flex items-center gap-2">
            <ImportLeads existingEmails={existingEmails} />
            <AddLeadForm
              dataSourceSuggestions={dataSourceSuggestions}
              industrySuggestions={industrySuggestions}
              serviceSuggestions={serviceSuggestions}
              assigneeSuggestions={assigneeSuggestions}
            />
          </div>
        }
      />

      <PageSortableLayout storageKey="leads-page-layout-v1" sections={[
        {
          id: 'kpi',
          label: 'KPI Cards',
          content: (
            <DraggableLeadCards
              leads={leads}
              mqlCount={mqlCount}
              sqlLeads={leads.filter(l => l.lead_status === 'SQL')}
              customers={customers}
              opportunityCount={opportunityCount}
              successfulMeetingsCount={successfulMeetingsCount}
              mqlTargetLabel={targets ? `target ${targets.monthly_mqls.toFixed(0)}/mo` : 'Marketing Qualified Leads'}
              sqlTargetLabel={targets ? `target ${targets.monthly_sqls.toFixed(0)}/mo` : undefined}
            />
          ),
        },
        {
          id: 'funnel',
          label: 'MQL + SQL Funnel',
          content: (
            <LeadsFunnelSection leads={leads.map(l => ({
              lead_date:        l.lead_date,
              lead_status:      l.lead_status,
              lead_source:      l.lead_source,
              data_source:      l.data_source,
              lead_stage:       l.lead_stage,
              customer_type:    l.customer_type,
              mrr_value:        l.mrr_value,
              one_time_revenue: l.one_time_revenue,
              name:             l.name,
              company_name:     l.company_name,
              assigned_to:      l.assigned_to,
            }))} />
          ),
        },
        {
          id: 'closed-won',
          label: 'Closed Won by Source',
          content: <ClosedWonBySource won={won} />,
        },
        {
          id: 'seats',
          label: 'Seats Closed',
          content: (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Armchair className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <h2 className="text-base font-extrabold text-slate-800">Seats Closed</h2>
                <span className="text-xs text-slate-400 font-medium">Closed Won deals only · 160 hrs = 1 seat</span>
              </div>
              <SeatsSection won={won} seatsTarget={seatsTarget} />
            </div>
          ),
        },
        {
          id: 'legend',
          label: 'Lead Classification',
          content: (
            <Panel icon={BookOpen} title="How leads map to the funnel" accent="amber"
              caption="Reference — every Lead Source is auto-classified by these rules">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <LegendBlock title="Digital MQL" cat="Digital MQL" sources={DIGITAL_MQL_SOURCES}
                  note="Top-of-funnel — must convert to an SQL" />
                <LegendBlock title="Direct SQL" cat="Direct SQL" sources={DIRECT_SQL_SOURCES}
                  note="Sales-qualified on arrival — skips the MQL stage" />
                <LegendBlock title="Event SQL" cat="Event SQL" sources={EVENT_SQL_SOURCES}
                  note="Conference / exhibition sourced — tracked separately" />
              </div>
            </Panel>
          ),
        },
        {
          id: 'charts',
          label: 'Lead Analytics',
          content: leads.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel icon={Layers} title="Leads by Source" accent="violet">
                <div className="pt-2">
                  <DonutChart data={bySource} centerValue={leads.length.toString()} centerLabel="Leads" />
                </div>
              </Panel>
              <Panel icon={CalendarCheck} title="Successful Meetings by Lead Source" accent="amber">
                <div className="pt-2">
                  <DonutChart data={bySourceSuccessful} centerValue={successfulMeetingLeads.length.toString()} centerLabel="Meetings" />
                </div>
              </Panel>
              <Panel icon={Trophy} title="Closed Won by Lead Source" accent="fuchsia">
                <div className="pt-2">
                  <DonutChart data={bySourceClosedWon} centerValue={closedWonLeads.length.toString()} centerLabel="Won" />
                </div>
              </Panel>
              <Panel icon={Zap} title="Leads by Stage" accent="indigo">
                <div className="pt-2"><HBarChart data={byStage} /></div>
              </Panel>
              <Panel icon={Database} title="Leads by Data Source" accent="emerald"
                caption={byDataSourceAll.length > DS_TOP ? `Top ${DS_TOP} of ${byDataSourceAll.length} sources` : undefined}>
                <div className="pt-2">
                  <DonutChart data={byDataSource} centerValue={leads.length.toString()} centerLabel="Leads" />
                </div>
              </Panel>
            </div>
          ) : null,
        },
        {
          id: 'source-breakdown',
          label: 'Source Breakdown',
          content: (
            <DraggableChartCards
              totalBySource={bySource}
              totalCount={leads.length}
              sqlBySource={bySourceSQL}
              sqlCount={sqlLeads.length}
              closedWonBySource={bySourceClosedWon}
              closedWonCount={closedWonLeads.length}
              meetingsByLeadFrom={byLeadFromSuccessful}
              meetingsCount={successfulMeetingsCount}
            />
          ),
        },
        {
          id: 'table',
          label: 'All Leads',
          content: (
            <LeadsTable
              leads={leads}
              dataSourceSuggestions={dataSourceSuggestions}
              industrySuggestions={industrySuggestions}
              serviceSuggestions={serviceSuggestions}
              assigneeSuggestions={assigneeSuggestions}
            />
          ),
        },
      ]} />
    </div>
  )
}


function LegendBlock({ title, cat, sources, note }: {
  title: string; cat: 'Digital MQL' | 'Direct SQL' | 'Event SQL'; sources: string[]; note: string
}) {
  return (
    <div className="rounded-xl ring-1 ring-slate-100 p-4 bg-slate-50/50">
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 ring-1 ${CATEGORY_STYLES[cat].badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLES[cat].dot}`} />
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {sources.map(s => (
          <span key={s} className="text-[11px] font-medium text-slate-600 bg-white ring-1 ring-slate-200 rounded-md px-2 py-0.5">{s}</span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">{note}</p>
    </div>
  )
}
