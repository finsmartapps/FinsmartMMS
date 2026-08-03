'use client'
import { useMemo, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Truck, CalendarDays, AlertTriangle,
  TrendingUp, ArrowUpRight, ArrowDownRight, Activity,
  CheckCircle2, Clock, Send, ChevronRight
} from 'lucide-react'
import type { WmsData } from './useWarehouseStore'

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number; sub?: string
  icon: React.ElementType; color: 'blue' | 'emerald' | 'amber' | 'rose'
}) {
  const colors = {
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-600',    val: 'text-blue-600'    },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-600', val: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: 'text-amber-600',   val: 'text-amber-600'   },
    rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    icon: 'text-rose-500',    val: 'text-rose-500'    },
  }
  const c = colors[color]
  return (
    <div className={`rounded-xl border ${c.border} bg-white p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon size={16} className={c.icon} />
        </div>
      </div>
      <div>
        <p className={`text-3xl font-bold ${c.val}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function ActivityFeed({ data }: { data: WmsData }) {
  const { shipments, events } = data
  const feed = useMemo(() => {
    return shipments.slice().reverse().slice(0, 8).map(s => {
      const ev = events.find(e => e.id === s.eventId)
      return {
        id: s.id, type: s.type,
        label: s.type === 'outbound' ? 'Dispatched to' : 'Returned from',
        event: ev?.name || 'Unknown Event',
        date: s.dispatchDate, status: s.status, count: s.items.length,
      }
    })
  }, [shipments, events])

  const statusBadge = (status: string) => {
    const m: Record<string, string> = {
      pending: 'bg-slate-100 text-slate-600', in_transit: 'bg-blue-500/15 text-blue-600',
      delivered: 'bg-emerald-500/15 text-emerald-600', at_event: 'bg-amber-500/15 text-amber-600',
      return_pending: 'bg-purple-500/15 text-purple-600', received: 'bg-emerald-500/15 text-emerald-600',
    }
    return m[status] || 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Recent Shipments</h3>
        <Activity size={15} className="text-slate-400" />
      </div>
      <div className="space-y-2">
        {feed.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No shipments yet</p>}
        {feed.map(row => (
          <div key={row.id} className="flex items-center gap-3 py-2.5 border-b border-slate-200 last:border-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${row.type === 'outbound' ? 'bg-blue-500/15' : 'bg-emerald-500/15'}`}>
              {row.type === 'outbound'
                ? <Send size={13} className="text-blue-600" />
                : <ArrowDownRight size={13} className="text-emerald-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-600 truncate">{row.label} <span className="text-slate-900">{row.event}</span></p>
              <p className="text-[10px] text-slate-400">{row.count} item type{row.count !== 1 ? 's' : ''} · {row.date}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 capitalize ${statusBadge(row.status)}`}>
              {row.status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LowStockAlert({ data }: { data: WmsData }) {
  const low = data.items.filter(i => i.quantity <= i.minStock)
  if (low.length === 0) return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 size={15} className="text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-700">Stock Levels</h3>
      </div>
      <p className="text-xs text-slate-400">All items are adequately stocked.</p>
    </div>
  )
  return (
    <div className="rounded-xl border border-amber-500/20 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={15} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-700">Low Stock Alerts</h3>
        <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full font-medium">{low.length} items</span>
      </div>
      <div className="space-y-2">
        {low.map(item => (
          <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-200 last:border-0">
            <div>
              <p className="text-xs font-medium text-slate-600">{item.label} · {item.name}</p>
              <p className="text-[10px] text-slate-400">{item.category}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-amber-600">{item.quantity} {item.unit}</p>
              <p className="text-[10px] text-slate-400">min {item.minStock}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function UpcomingEvents({ data }: { data: WmsData }) {
  const upcoming = data.events
    .filter(e => e.status === 'upcoming' || e.status === 'active')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 4)

  const statusColor: Record<string, string> = {
    upcoming: 'text-blue-600 bg-blue-500/10', active: 'text-emerald-600 bg-emerald-500/10',
    completed: 'text-slate-500 bg-slate-100', cancelled: 'text-rose-500 bg-rose-500/10',
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Upcoming Events</h3>
        <Clock size={15} className="text-slate-400" />
      </div>
      {upcoming.length === 0
        ? <p className="text-xs text-slate-400 py-4 text-center">No upcoming events</p>
        : (
          <div className="space-y-3">
            {upcoming.map(ev => (
              <div key={ev.id} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-slate-500 leading-none">{ev.startDate.split('-')[1]}</span>
                  <span className="text-sm font-bold text-slate-900 leading-none">{ev.startDate.split('-')[2]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{ev.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{ev.location}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${statusColor[ev.status]}`}>
                  {ev.status}
                </span>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

function CategoryBreakdown({ data }: { data: WmsData }) {
  const cats: Record<string, number> = {}
  data.items.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1 })
  const total = data.items.length
  const catColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500']

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Items by Category</h3>
      <div className="space-y-3">
        {Object.entries(cats).map(([cat, count], i) => (
          <div key={cat}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600">{cat}</span>
              <span className="text-xs text-slate-500">{count} items</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${catColors[i % catColors.length]}`} style={{ width: `${(count / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type EvItemRow = { label: string; name: string; unit: string; sent: number; returned: number; consumed: number }
type EvRow = { id: string; name: string; date: string; location: string; sent: number; returned: number; consumed: number; items: EvItemRow[] }

function ConsumedByEvent({ data }: { data: WmsData }) {
  const { events, items, shipments } = data
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const rows = useMemo<EvRow[]>(() => {
    const SENT_STATUSES = new Set(['in_transit', 'delivered', 'at_event', 'return_pending', 'received', 'consumed'])
    const RETURNED_STATUSES = new Set(['delivered', 'received'])

    const perEvent: Record<string, Record<string, { sent: number; returned: number }>> = {}
    events.forEach(ev => { perEvent[ev.id] = {} })
    shipments.forEach(s => {
      const m = perEvent[s.eventId]
      if (!m) return
      const add = (itemId: string, qty: number, key: 'sent' | 'returned') => {
        if (!m[itemId]) m[itemId] = { sent: 0, returned: 0 }
        m[itemId][key] += qty
      }
      if (s.type === 'outbound' && SENT_STATUSES.has(s.status)) s.items.forEach(({ itemId, quantity }) => add(itemId, quantity, 'sent'))
      else if (s.type === 'inbound' && RETURNED_STATUSES.has(s.status)) s.items.forEach(({ itemId, quantity }) => add(itemId, quantity, 'returned'))
    })

    const out: EvRow[] = []
    events.forEach(ev => {
      const itemRows: EvItemRow[] = []
      let sent = 0, returned = 0, consumed = 0
      Object.entries(perEvent[ev.id] || {}).forEach(([itemId, v]) => {
        const c = Math.max(0, v.sent - v.returned)
        if (c <= 0) return
        const item = items.find(i => i.id === itemId)
        if (!item) return
        itemRows.push({ label: item.label, name: item.name, unit: item.unit, sent: v.sent, returned: v.returned, consumed: c })
        sent += v.sent; returned += v.returned; consumed += c
      })
      if (consumed > 0) {
        itemRows.sort((a, b) => b.consumed - a.consumed)
        out.push({ id: ev.id, name: ev.name, date: ev.startDate, location: ev.location, sent, returned, consumed, items: itemRows })
      }
    })
    out.sort((a, b) => b.date.localeCompare(a.date))
    return out
  }, [events, items, shipments])

  const totals = rows.reduce((a, r) => ({ sent: a.sent + r.sent, returned: a.returned + r.returned, consumed: a.consumed + r.consumed }), { sent: 0, returned: 0, consumed: 0 })
  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Consumed by Event</h3>
        <span className="text-[10px] text-slate-400">consumed = sent − returned · click a row for item detail</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">Nothing consumed yet — returns cover all outbound shipments.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="pb-2 font-medium">Event</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-center">Items</th>
                <th className="pb-2 font-medium text-right">Sent</th>
                <th className="pb-2 font-medium text-right">Returned</th>
                <th className="pb-2 font-medium text-right">Consumed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const open = expanded.has(r.id)
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => toggle(r.id)} className="border-b border-slate-100 cursor-pointer hover:bg-slate-50">
                      <td className="py-2 text-xs font-medium text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <ChevronRight size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                          {r.name}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-slate-500">{r.date}</td>
                      <td className="py-2 text-xs text-slate-500 text-center">{r.items.length}</td>
                      <td className="py-2 text-xs text-slate-500 text-right">{r.sent}</td>
                      <td className="py-2 text-xs text-slate-500 text-right">{r.returned}</td>
                      <td className="py-2 text-right"><span className="text-xs font-bold text-amber-600">{r.consumed}</span></td>
                    </tr>
                    {open && r.items.map((it, j) => (
                      <tr key={r.id + '-' + j} className="border-b border-slate-100 bg-slate-50/50">
                        <td className="py-1.5 pl-6 text-[11px] text-slate-600" colSpan={2}>
                          <span className="font-medium text-slate-700">{it.label}</span> · {it.name}
                        </td>
                        <td className="py-1.5 text-[11px] text-slate-400 text-center">{it.unit}</td>
                        <td className="py-1.5 text-[11px] text-slate-500 text-right">{it.sent}</td>
                        <td className="py-1.5 text-[11px] text-slate-500 text-right">{it.returned}</td>
                        <td className="py-1.5 text-[11px] font-semibold text-amber-600 text-right">{it.consumed}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <td colSpan={3} className="pt-2 text-[10px] text-slate-400 uppercase tracking-wider">Total across {rows.length} event{rows.length !== 1 ? 's' : ''}</td>
                <td className="pt-2 text-right text-xs text-slate-500">{totals.sent}</td>
                <td className="pt-2 text-right text-xs text-slate-500">{totals.returned}</td>
                <td className="pt-2 text-right text-xs font-bold text-slate-700">{totals.consumed}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ data }: { data: WmsData }) {
  const router = useRouter()
  const { items, events, shipments } = data

  const activeShipments = shipments.filter(s => s.status === 'in_transit' || s.status === 'at_event')
  const upcomingEvents = events.filter(e => e.status === 'upcoming' || e.status === 'active')
  const lowStock = items.filter(i => i.quantity <= i.minStock)
  const totalItems = items.reduce((a, b) => a + b.quantity, 0)

  const quickActions = [
    { label: 'Add Item',     icon: Package,     path: '/warehouse/inventory', color: 'blue'   },
    { label: 'New Event',    icon: CalendarDays, path: '/warehouse/events',   color: 'emerald' },
    { label: 'New Shipment', icon: Truck,        path: '/warehouse/shipments',color: 'amber'   },
    { label: 'View Reports', icon: TrendingUp,   path: '/warehouse/reports',  color: 'purple'  },
  ]

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue:    { bg: 'bg-blue-500/15',    icon: 'text-blue-600'    },
    emerald: { bg: 'bg-emerald-500/15', icon: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-500/15',   icon: 'text-amber-600'   },
    purple:  { bg: 'bg-purple-500/15',  icon: 'text-purple-600'  },
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Warehouse Overview</h2>
        <p className="text-sm text-slate-500 mt-0.5">Inventory, events, and shipment status at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total SKUs"        value={items.length}            sub={`${totalItems} total units`}     icon={Package}      color="blue"    />
        <StatCard label="Upcoming Events"   value={upcomingEvents.length}   sub="Need planning"                   icon={CalendarDays} color="emerald" />
        <StatCard label="Active Shipments"  value={activeShipments.length}  sub="In transit or at event"          icon={Truck}        color="amber"   />
        <StatCard label="Low Stock Alerts"  value={lowStock.length}         sub={lowStock.length ? 'Needs restock' : 'All good'} icon={AlertTriangle} color={lowStock.length ? 'rose' : 'emerald'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityFeed data={data} />
        </div>
        <div className="space-y-4">
          <UpcomingEvents data={data} />
          <LowStockAlert data={data} />
        </div>
      </div>

      <ConsumedByEvent data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdown data={data} />
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ label, icon: Icon, path, color }) => {
              const c = colorMap[color]
              return (
                <button
                  key={label}
                  onClick={() => router.push(path)}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all group"
                >
                  <div className={`w-7 h-7 rounded-md ${c.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className={c.icon} />
                  </div>
                  <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
                  <ArrowUpRight size={12} className="ml-auto text-slate-300 group-hover:text-slate-500 transition-colors" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
