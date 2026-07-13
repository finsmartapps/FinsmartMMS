'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Warehouse, LogOut, CheckCircle2, Truck, CalendarDays,
  Hash, ChevronDown, ChevronUp, Clock, PackageCheck,
  Send, AlertCircle, Loader2,
} from 'lucide-react'
import { useWarehouseStore, type WmsShipment, type WmsItem, type WmsEvent } from './useWarehouseStore'

const ACTIVE_STATUSES = ['pending', 'packed']
const DISPATCHED_STATUSES = ['in_transit', 'delivered', 'at_event']

function AllClearCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
      <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={28} className="text-emerald-600" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">All clear!</h3>
      <p className="text-xs text-slate-500">No pending shipments. Check back later.</p>
    </div>
  )
}

function ShipmentCard({
  shipment, events, items, onStatusUpdate,
}: {
  shipment: WmsShipment
  events: WmsEvent[]
  items: WmsItem[]
  onStatusUpdate: (id: string, changes: Partial<WmsShipment>) => Promise<unknown>
}) {
  const event = events.find(e => e.id === shipment.eventId)
  const [tracking, setTracking] = useState(shipment.trackingRef || '')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const isPending = shipment.status === 'pending'
  const isPacked  = shipment.status === 'packed'

  const handlePack = async () => {
    setSaving(true)
    await onStatusUpdate(shipment.id, { status: 'packed' })
    setSaving(false)
  }

  const handleDispatch = async () => {
    if (!tracking.trim()) return
    setSaving(true)
    await onStatusUpdate(shipment.id, { status: 'in_transit', trackingRef: tracking.trim() })
    setSaving(false)
  }

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${isPacked ? 'border-blue-500/40' : 'border-slate-200'}`}>
      <div
        className="flex items-start justify-between px-5 py-4 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isPending && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Pack & Ship</span>
            )}
            {isPacked && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600">Ready to Dispatch</span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900 leading-snug">{event?.name || 'Unknown Event'}</h3>
          <div className="flex items-center gap-3 mt-1.5">
            {shipment.dispatchDate && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <CalendarDays size={11} />
                <span>Ship by {shipment.dispatchDate}</span>
              </div>
            )}
            {event?.location && (
              <div className="text-xs text-slate-400">→ {event.location}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-700">{shipment.items.length} item types</p>
            <p className="text-[10px] text-slate-400">{shipment.items.reduce((a, b) => a + b.quantity, 0)} units</p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {isPacked ? 'Packed Items' : 'Items to Pack'}
            </p>
            {shipment.items.map((line, i) => {
              const item = items.find(it => it.id === line.itemId)
              return (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isPacked ? 'bg-blue-50' : 'bg-slate-50'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isPacked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                    {isPacked && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-blue-600">{item?.label || '?'}</span>
                      <span className="text-xs text-slate-700 font-medium truncate">{item?.name || 'Unknown'}</span>
                    </div>
                    {item?.location && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Location: {item.location}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-900 flex-shrink-0">× {line.quantity}</span>
                </div>
              )
            })}
          </div>

          {shipment.notes && (
            <div className="mx-5 mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{shipment.notes}</p>
            </div>
          )}

          <div className="px-5 pb-5">
            {isPending && (
              <button
                onClick={handlePack}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60 shadow-lg shadow-blue-500/20"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                {saving ? 'Saving…' : 'Mark as Packed'}
              </button>
            )}
            {isPacked && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">GTL Tracking Reference *</label>
                  <input
                    value={tracking}
                    onChange={e => setTracking(e.target.value)}
                    placeholder="e.g. GTL-20260701-001"
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  onClick={handleDispatch}
                  disabled={saving || !tracking.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60 shadow-lg shadow-emerald-500/20"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {saving ? 'Dispatching…' : 'Mark as Dispatched'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DispatchedCard({ shipment, events, items }: { shipment: WmsShipment; events: WmsEvent[]; items: WmsItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const event = events.find(e => e.id === shipment.eventId)
  const statusLabel: Record<string, string> = { in_transit: 'In Transit', delivered: 'Delivered', at_event: 'At Event' }
  const statusColor: Record<string, string> = { in_transit: 'text-blue-600', delivered: 'text-emerald-600', at_event: 'text-amber-600' }
  const statusBg: Record<string, string>    = { in_transit: 'bg-blue-500/10', delivered: 'bg-emerald-500/10', at_event: 'bg-amber-500/10' }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <Truck size={14} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{event?.name || 'Unknown'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-semibold ${statusColor[shipment.status] || 'text-slate-500'}`}>
              {statusLabel[shipment.status] || shipment.status}
            </span>
            {shipment.trackingRef && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Hash size={9} />{shipment.trackingRef}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-400">{shipment.dispatchDate}</span>
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          {/* Status + meta */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full ${statusBg[shipment.status] || 'bg-slate-100'} ${statusColor[shipment.status] || 'text-slate-600'}`}>
              <Truck size={11} />
              {statusLabel[shipment.status] || shipment.status}
            </span>
            {shipment.trackingRef && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">
                <Hash size={11} />{shipment.trackingRef}
              </span>
            )}
          </div>

          {/* Event details */}
          <div className="space-y-1.5">
            {event?.location && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-400 w-16 flex-shrink-0">Destination</span>
                <span className="text-slate-700">{event.location}</span>
              </div>
            )}
            {shipment.dispatchDate && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-400 w-16 flex-shrink-0">Dispatched</span>
                <span className="text-slate-700">{shipment.dispatchDate}</span>
              </div>
            )}
            {shipment.deliveryDate && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-400 w-16 flex-shrink-0">Delivered</span>
                <span className="text-slate-700">{shipment.deliveryDate}</span>
              </div>
            )}
          </div>

          {/* Items */}
          {shipment.items.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Items Shipped</p>
              {shipment.items.map((line, i) => {
                const item = items.find(it => it.id === line.itemId)
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-blue-600">{item?.label || '?'}</span>
                        <span className="text-xs text-slate-700 font-medium truncate">{item?.name || 'Unknown'}</span>
                      </div>
                      {item?.location && (
                        <p className="text-[10px] text-slate-400 mt-0.5">Location: {item.location}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-900 flex-shrink-0">× {line.quantity}</span>
                  </div>
                )
              })}
            </div>
          )}

          {shipment.notes && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{shipment.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ManagerView() {
  const router = useRouter()
  const { data, loading, updateShipment } = useWarehouseStore()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Warehouse size={28} className="text-white" />
          </div>
          <Loader2 size={20} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading your queue…</p>
        </div>
      </div>
    )
  }

  const { shipments, events, items } = data

  const activeShipments = shipments
    .filter(s => s.type === 'outbound' && ACTIVE_STATUSES.includes(s.status))
    .sort((a, b) => a.dispatchDate.localeCompare(b.dispatchDate))

  const dispatchedShipments = shipments
    .filter(s => s.type === 'outbound' && DISPATCHED_STATUSES.includes(s.status))
    .sort((a, b) => b.dispatchDate.localeCompare(a.dispatchDate))
    .slice(0, 8)

  const pendingCount = activeShipments.filter(s => s.status === 'pending').length
  const packedCount  = activeShipments.filter(s => s.status === 'packed').length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Warehouse size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">GTL Warehouse</p>
              <p className="text-[10px] text-slate-500 leading-tight">Finsmart Shipment Queue</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {(pendingCount > 0 || packedCount > 0) && (
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                <Clock size={14} className="text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">{pendingCount} to pack</span>
              </div>
            )}
            {packedCount > 0 && (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5">
                <PackageCheck size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">{packedCount} ready to dispatch</span>
              </div>
            )}
          </div>
        )}

        {activeShipments.length === 0 ? (
          <AllClearCard />
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shipment Queue</p>
            {activeShipments.map(s => (
              <ShipmentCard
                key={s.id}
                shipment={s}
                events={events}
                items={items}
                onStatusUpdate={(id, changes) => updateShipment(id, changes)}
              />
            ))}
          </div>
        )}

        {dispatchedShipments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recently Dispatched</p>
            {dispatchedShipments.map(s => (
              <DispatchedCard key={s.id} shipment={s} events={events} items={items} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
