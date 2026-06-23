import { createClient } from '@/lib/supabase/server'
import type { Settings, Segment, Channel, PlanEvent } from '@/types'
import SettingsForm from '@/components/marketing/settings/settings-form'
import { PageHero } from '@/components/marketing/ui/panel'
import { Settings as SettingsIcon } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const [
    { data: settingsRows },
    { data: segments },
    { data: channels },
    { data: events },
  ] = await Promise.all([
    supabase.from('marketing_settings').select('*').limit(1),
    supabase.from('segments').select('*').order('sort_order'),
    supabase.from('channels').select('*').order('sort_order'),
    supabase.from('plan_events').select('*').order('sort_order'),
  ])

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1100px] mx-auto">
      <PageHero
        icon={SettingsIcon}
        title="Settings"
        subtitle="Edit annual targets, segment splits, channel MQL targets, and the event plan"
      />
      <SettingsForm
        settings={settingsRows?.[0] as Settings | undefined}
        segments={(segments ?? []) as Segment[]}
        channels={(channels ?? []) as Channel[]}
        events={(events ?? []) as PlanEvent[]}
      />
    </div>
  )
}
