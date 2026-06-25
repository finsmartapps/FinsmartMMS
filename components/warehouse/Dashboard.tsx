'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Truck, CalendarDays, AlertTriangle,
  TrendingUp, ArrowUpRight, ArrowDownRight, Activity,
  CheckCircle2, Clock, Send
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
