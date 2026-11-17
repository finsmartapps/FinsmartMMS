import type { SupabaseClient } from '@supabase/supabase-js'
import { askStep } from './ask'
import { sitemapStep, readinessStep } from './sites'
import { gscStep } from './gsc'
import { suggestStep } from './suggest'

// One step of the weekly AI Visibility job. Shared by the cron route (CRON_SECRET) and the
// "Run now" route (signed-in Marketing user).
//   ask        answer a few (question, engine) pairs; repeat until {done:true}
//   sites      read one brand's sitemap;              repeat until {done:true}
//   readiness  AI readiness checks for every tracked brand
//   gsc        Search Console snapshot + question suggestions
//   suggest    AI-suggested new questions
// force: start a new ask run / re-read sitemaps even if the last one is under a week old.

export const STEPS = ['ask', 'sites', 'readiness', 'gsc', 'suggest'] as const
export type Step = typeof STEPS[number]

const KEY_PAGES = (process.env.AIV_KEY_PAGES ||
  '/,/accounting-seat-model/,/solutions/cpa-accounting-firms/,/services/outsourced-accounting/,/services/bookkeeping/,/services/tax-preparation/,/services/white-label-accounting-services/,/services/hire-dedicated-accountant/')
  .split(',').map(s => s.trim()).filter(Boolean)

export async function runStep(db: SupabaseClient, step: string, force: boolean): Promise<Record<string, unknown>> {
  if (step === 'ask') return askStep(db, { force })

  if (step === 'sites') {
    // force: anything not read in the last hour (so a brand read in this same loop is not picked again)
    const cutoff = new Date(Date.now() - (force ? 3_600_000 : 6 * 86_400_000)).toISOString()
    const { data: brand } = await db.from('aiv_brands')
      .select('id, domain, sitemap_baselined, sites_checked_at')
      .eq('active', true).eq('track_site', true)
      .or(`sites_checked_at.is.null,sites_checked_at.lt.${cutoff}`)
      .order('sites_checked_at', { ascending: true, nullsFirst: true })
      .limit(1).maybeSingle()
    if (!brand) return { done: true }
    const r = await sitemapStep(db, brand)
    // Mark checked even when the sitemap was unreadable, so one blocked site cannot stall the loop.
    if (!('urls' in r)) await db.from('aiv_brands').update({ sites_checked_at: new Date().toISOString() }).eq('id', brand.id)
    return { done: false, ...r }
  }

  if (step === 'readiness') {
    const { data: brands } = await db.from('aiv_brands').select('id, domain, is_us').eq('active', true).eq('track_site', true)
    const results = []
    for (const b of brands ?? []) results.push(await readinessStep(db, b, KEY_PAGES))
    return { done: true, results }
  }

  if (step === 'gsc') return { done: true, ...(await gscStep(db)) }
  if (step === 'suggest') return { done: true, ...(await suggestStep(db)) }
  throw new Error('Unknown step. Use ask, sites, readiness, gsc or suggest.')
}
