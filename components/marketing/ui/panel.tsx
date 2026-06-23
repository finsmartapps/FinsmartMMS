import type { ElementType } from 'react'

const ACCENTS: Record<string, string> = {
  indigo:  'text-indigo-500 bg-indigo-50',
  violet:  'text-violet-500 bg-violet-50',
  emerald: 'text-emerald-500 bg-emerald-50',
  amber:   'text-amber-500 bg-amber-50',
  fuchsia: 'text-fuchsia-500 bg-fuchsia-50',
}

export function Panel({
  icon: Icon, title, caption, accent = 'indigo', children, className = '', noPad = false, action,
}: {
  icon: ElementType
  title: string
  caption?: string
  accent?: keyof typeof ACCENTS | string
  children: React.ReactNode
  className?: string
  noPad?: boolean
  action?: React.ReactNode
}) {
  return (
    <section className={`bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ACCENTS[accent] ?? ACCENTS.indigo}`}>
          <Icon strokeWidth={2.5} style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-800 leading-tight">{title}</h2>
          {caption && <p className="text-xs text-slate-400 mt-0.5 truncate">{caption}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={noPad ? '' : 'px-5 py-4'}>{children}</div>
    </section>
  )
}

export function PageHero({ icon: Icon, title, subtitle, action }: { icon: ElementType; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 md:p-7 animate-rise">
      <div className="absolute -top-16 -right-8 w-60 h-60 bg-white/15 rounded-full blur-3xl animate-mesh pointer-events-none" aria-hidden />
      <div className="absolute -bottom-20 left-1/4 w-56 h-56 bg-fuchsia-300/20 rounded-full blur-3xl animate-mesh pointer-events-none" style={{ animationDelay: '3s' }} aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25 shrink-0">
            <Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{title}</h1>
            <p className="text-sm text-white/70 mt-1 max-w-2xl">{subtitle}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

export function Th({ children, right, center, className = '' }: { children?: React.ReactNode; right?: boolean; center?: boolean; className?: string }) {
  return (
    <th className={`text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-2 ${right ? 'text-right' : center ? 'text-center' : 'text-left'} ${className}`}>
      {children}
    </th>
  )
}

export function Pill({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center min-w-9 h-6 rounded-lg text-xs font-bold tabular-nums px-2 ${
      strong ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
    }`}>
      {children}
    </span>
  )
}

export function ConvBadge({ pct }: { pct: number }) {
  const cls = pct >= 40 ? 'bg-emerald-50 text-emerald-700' : pct >= 25 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
  return <span className={`inline-flex items-center justify-center text-xs font-bold rounded-lg px-2 py-0.5 tabular-nums ${cls}`}>{pct.toFixed(0)}%</span>
}

export function QuarterPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center text-xs font-bold text-violet-700 bg-violet-50 ring-1 ring-violet-100 rounded-full px-2.5 py-0.5">{children}</span>
}
