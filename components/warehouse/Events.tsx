'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Plus, MapPin, Edit2, Trash2, X,
  ChevronRight, Truck, Clock, CheckCircle2, XCircle, Zap
} from 'lucide-react'
import { EVENT_STATUSES, type WmsEvent, type WmsData } from './useWarehouseStore'

const EMPTY_EVENT: WmsEvent = { id: '', name: '', location: '', startDate: '', endDate: '', status: 'upcoming', notes: '' }

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  upcoming:  { color: 'blue',    label: 'Upcoming',  icon: Clock        },
  active:    { color: 'emerald', label: 'Active',    icon: Zap          },
  completed: { color: 'slate',   label: 'Completed', icon: CheckCircle2 },
  cancelled: { color: 'rose',    label: 'Cancelled', icon: XCircle      },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming
  const Icon = cfg.icon
  const c: Record<string, string> = {
    blue:    'bg-blue-500/15 text-blue-600 border-blue-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
    slate:   'bg-slate-100 text-slate-500 border-slate-200',
    rose:    'bg-rose-500/15 text-rose-500 border-rose-500/20',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${c[cfg.color]}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

function EventModal({ event, onSave, onClose }: {
  event: WmsEvent; onSave: (form: WmsEvent) => void; onClose: () => void
}) {
  const isNew = !event.id
  const [form, setForm] = useState(event)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name required'
    if (!form.startDate) e.startDate = 'Start date required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{isNew ? 'Create Event' : 'Edit Event'}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"><X size={14} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Event Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tech Summit 2026"
              className={`w-full bg-slate-100 border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors ${errors.name ? 'border-rose-500' : 'border-slate-200'}`} />
            {errors.name && <p className="text-[10px] text-rose-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Location</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Venue, City"
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                className={`w-full bg-slate-100 border rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors ${errors.startDate ? 'border-rose-500' : 'border-slate-200'}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">End Date</label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors">
              {EVENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any event notes..." rows={2}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all">Cancel</button>
          <button onClick={() => { if (validate()) onSave(form) }} className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all">{isNew ? 'Create Event' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

function EventCard({ event, shipments, onEdit, onDelete, onViewShipments }: {
  event: WmsEvent; shipments: WmsData['shipments']
  onEdit: (e: WmsEvent) => void; onDelete: (e: WmsEvent) => void; onViewShipments: (e: WmsEvent) => void
}) {
  const eventShipments = shipments.filter(s => s.eventId === event.id)
  const outbound = eventShipments.filter(s => s.type === 'outbound')
  const inbound = eventShipments.filter(s => s.type === 'inbound')
  const uniqueItems = new Set(eventShipments.flatMap(s => s.items.map(i => i.itemId))).size

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{event.name}</h3>
          {event.location && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={11} className="text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500 truncate">{event.location}</span>
            </div>
          )}
        </div>
        <StatusBadge status={event.status} />
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={12} className="text-slate-400" />
          <span className="text-xs text-slate-500">{event.startDate}</span>
        </div>
        {event.endDate && event.endDate !== event.startDate && (
          <><span className="text-slate-300">→</span><span className="text-xs text-slate-500">{event.endDate}</span></>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center py-2 rounded-lg bg-slate-50">
          <p className="text-sm font-bold text-blue-600">{outbound.length}</p>
          <p className="text-[10px] text-slate-400">Outbound</p>
        </div>
        <div className="text-center py-2 rounded-lg bg-slate-50">
          <p className="text-sm font-bold text-emerald-600">{inbound.length}</p>
          <p className="text-[10px] text-slate-400">Returns</p>
        </div>
        <div className="text-center py-2 rounded-lg bg-slate-50">
          <p className="text-sm font-bold text-slate-600">{uniqueItems}</p>
          <p className="text-[10px] text-slate-400">Item Types</p>
        </div>
      </div>
      {event.notes && <p className="text-xs text-slate-400 mb-4 italic">"{event.notes}"</p>}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
        <button onClick={() => onViewShipments(event)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all">
          <Truck size={12} /> View Shipments <ChevronRight size={11} />
        </button>
        <button onClick={() => onEdit(event)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 transition-all"><Edit2 size={12} /></button>
        <button onClick={() => onDelete(event)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

export default function Events({ data, addEvent, updateEvent, deleteEvent }: {
  data: WmsData
  addEvent: (e: Partial<WmsEvent>) => Promise<unknown>
  updateEvent: (id: string, e: Partial<WmsEvent>) => Promise<unknown>
  deleteEvent: (id: string) => Promise<unknown>
}) {
  const router = useRouter()
  const { events, shipments } = data
  const [modal, setModal] = useState<WmsEvent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WmsEvent | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = events.filter(e => statusFilter === 'all' || e.status === statusFilter)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  const handleSave = (form: WmsEvent) => {
    if (form.id) updateEvent(form.id, form)
    else addEvent(form)
    setModal(null)
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {modal && <EventModal event={modal} onSave={handleSave} onClose={() => setModal(null)} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-rose-500" /></div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Delete Event?</h3>
            <p className="text-xs text-slate-500 mb-6">"{deleteTarget.name}" and all its shipment records will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => { deleteEvent(deleteTarget.id); setDeleteTarget(null) }} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Events</h2>
          <p className="text-xs text-slate-500 mt-0.5">{events.length} events total</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY_EVENT })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-500/20">
          <Plus size={15} /> Create Event
        </button>
      </div>

      <div className="flex items-center gap-2">
        {[['all', 'All'], ['upcoming', 'Upcoming'], ['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === val ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-20 text-center">
          <CalendarDays size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No events found</p>
          <button onClick={() => setModal({ ...EMPTY_EVENT })} className="mt-4 text-xs text-blue-600 hover:text-blue-500 transition-colors">+ Create your first event</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(event => (
            <EventCard
              key={event.id}
              event={event}
              shipments={shipments}
              onEdit={e => setModal({ ...e })}
              onDelete={e => setDeleteTarget(e)}
              onViewShipments={e => router.push(`/warehouse/shipments?event=${e.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
