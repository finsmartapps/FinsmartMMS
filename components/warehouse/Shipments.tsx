'use client'
import { useState, useMemo, useRef } from 'react'
import {
  Truck, Plus, X, Send, ArrowDownLeft, Package,
  Edit2, Trash2, ChevronDown, ChevronUp, Hash,
  ImagePlus, Image as ImageIcon, Loader2, ZoomIn,
  PackageX, AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SHIPMENT_STATUSES, type WmsShipment, type WmsItem, type WmsData } from './useWarehouseStore'

const EMPTY_SHIPMENT: WmsShipment = {
  id: '', eventId: '', type: 'outbound', status: 'pending',
  dispatchDate: '', deliveryDate: '', trackingRef: '', notes: '',
  items: [], images: [],
}

const TYPE_CONFIG = {
  outbound: { icon: Send,          color: 'blue',    label: 'Outbound' },
  inbound:  { icon: ArrowDownLeft, color: 'emerald', label: 'Return'   },
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600', packed: 'bg-cyan-500/15 text-cyan-600',
  in_transit: 'bg-blue-500/15 text-blue-600', delivered: 'bg-emerald-500/15 text-emerald-600',
  at_event: 'bg-amber-500/15 text-amber-600', return_pending: 'bg-purple-500/15 text-purple-600',
  received: 'bg-emerald-500/15 text-emerald-600', consumed: 'bg-orange-500/15 text-orange-600',
}

async function uploadImages(files: File[], shipmentId: string): Promise<string[]> {
  const supabase = createClient()
  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop()
    const path = `${shipmentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('wms-shipment-images').upload(path, file, { upsert: false })
    if (!error) {
      const { data } = supabase.storage.from('wms-shipment-images').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
  }
  return urls
}

async function deleteImage(url: string) {
  const supabase = createClient()
  const path = url.split('/wms-shipment-images/')[1]
  if (path) await supabase.storage.from('wms-shipment-images').remove([path])
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"><X size={18} /></button>
      <img src={url} alt="Shipment attachment" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  )
}

function ImageUploader({ existingUrls, pendingFiles, onAddFiles, onRemoveExisting, onRemovePending }: {
  existingUrls: string[]; pendingFiles: File[]
  onAddFiles: (f: File[]) => void; onRemoveExisting: (i: number) => void; onRemovePending: (i: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) onAddFiles(files)
    e.target.value = ''
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-500">Images / Attachments</label>
        <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-500 transition-colors">
          <ImagePlus size={13} /> Add Photos
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePick} />
      </div>
      {(existingUrls.length > 0 || pendingFiles.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {existingUrls.map((url, i) => (
            <div key={url} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onRemoveExisting(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} className="text-white" /></button>
            </div>
          ))}
          {pendingFiles.map((file, i) => (
            <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-blue-500/40">
              <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-blue-900/20" />
              <button type="button" onClick={() => onRemovePending(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} className="text-white" /></button>
            </div>
          ))}
        </div>
      )}
      {existingUrls.length === 0 && pendingFiles.length === 0 && (
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full border border-dashed border-slate-200 rounded-lg py-5 flex flex-col items-center gap-2 text-slate-400 hover:border-blue-500/50 hover:text-slate-500 transition-all">
          <ImageIcon size={20} /><span className="text-xs">Click to attach photos of shipment</span>
        </button>
      )}
    </div>
  )
}

function ConsumeModal({ shipment, items, onConfirm, onCancel, saving }: {
  shipment: WmsShipment; items: WmsItem[]; saving: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  const lines = shipment.items.map(line => {
    const item = items.find(i => i.id === line.itemId)
    return item ? { item, shipped: line.quantity, newQty: Math.max(0, item.quantity - line.quantity) } : null
  }).filter(Boolean) as { item: WmsItem; shipped: number; newQty: number }[]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="w-12 h-12 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto mb-4"><PackageX size={20} className="text-orange-600" /></div>
        <h3 className="text-sm font-semibold text-slate-900 text-center mb-1">Mark as Consumed?</h3>
        <p className="text-xs text-slate-500 text-center mb-5">These items won't return. Inventory will be permanently reduced.</p>
        <div className="space-y-2 mb-5">
          {lines.map(({ item, shipped, newQty }) => (
            <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <div><span className="text-[10px] font-mono font-bold text-blue-600">{item.label}</span><span className="text-xs text-slate-600 ml-2">{item.name}</span></div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">{item.quantity}</span>
                <span className="text-slate-300">→</span>
                <span className={newQty <= 0 ? 'text-rose-500 font-bold' : 'text-slate-700 font-semibold'}>{newQty}</span>
                <span className="text-orange-600 font-medium">(−{shipped})</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-5">
          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700">This cannot be undone. Quantities will be permanently deducted from inventory.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShipmentModal({ shipment, data, onSave, onClose }: {
  shipment: WmsShipment; data: WmsData; onSave: (s: WmsShipment) => void; onClose: () => void
}) {
  const isNew = !shipment.id
  const { events, items } = data
  const [form, setForm] = useState({ ...shipment, items: [...(shipment.items || [])], images: [...(shipment.images || [])] })
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const addLine = () => setForm(f => ({ ...f, items: [...f.items, { itemId: '', quantity: 1 }] }))
  const removeLine = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const setLine = (i: number, k: string, v: string | number) => setForm(f => ({ ...f, items: f.items.map((l, idx) => idx === i ? { ...l, [k]: v } : l) }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.eventId) e.eventId = 'Select an event'
    if (!form.dispatchDate) e.dispatchDate = 'Date required'
    if (form.items.length === 0) e.items = 'Add at least one item'
    if (form.items.some(l => !l.itemId)) e.items = 'Select an item for each line'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const shipmentId = form.id || `new-${Date.now()}`
    const newUrls = pendingFiles.length > 0 ? await uploadImages(pendingFiles, shipmentId) : []
    onSave({ ...form, items: form.items.map(l => ({ ...l, quantity: Number(l.quantity) })), images: [...form.images, ...newUrls] })
  }

  const handleRemoveExisting = async (i: number) => {
    const url = form.images[i]
    await deleteImage(url)
    setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">{isNew ? 'Create Shipment' : 'Edit Shipment'}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"><X size={14} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Event *</label>
              <select value={form.eventId} onChange={e => set('eventId', e.target.value)}
                className={`w-full bg-slate-100 border rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors ${errors.eventId ? 'border-rose-500' : 'border-slate-200'}`}>
                <option value="">Select event...</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              {errors.eventId && <p className="text-[10px] text-rose-500 mt-1">{errors.eventId}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors">
                <option value="outbound">Outbound (To Event)</option>
                <option value="inbound">Inbound (Return)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Dispatch Date *</label>
              <input type="date" value={form.dispatchDate} onChange={e => set('dispatchDate', e.target.value)}
                className={`w-full bg-slate-100 border rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors ${errors.dispatchDate ? 'border-rose-500' : 'border-slate-200'}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Delivery Date</label>
              <input type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
              {form.status === 'consumed' ? (
                <div className="w-full bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-orange-600 font-medium">Consumed (final)</div>
              ) : (
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors">
                  {SHIPMENT_STATUSES.filter(s => s !== 'consumed').map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Tracking Reference (GTL)</label>
            <input value={form.trackingRef} onChange={e => set('trackingRef', e.target.value)} placeholder="e.g. GTL-20260701-001"
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Items in Shipment *</label>
              <button type="button" onClick={addLine} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-500 transition-colors"><Plus size={12} />Add Line</button>
            </div>
            {errors.items && <p className="text-[10px] text-rose-500 mb-2">{errors.items}</p>}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {form.items.length === 0 && (
                <div className="py-5 text-center border border-dashed border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-400">No items added yet</p>
                  <button type="button" onClick={addLine} className="mt-1 text-[11px] text-blue-600 hover:text-blue-500 transition-colors">+ Add item</button>
                </div>
              )}
              {form.items.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={line.itemId} onChange={e => setLine(i, 'itemId', e.target.value)}
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 transition-colors">
                    <option value="">Select item...</option>
                    {items.map(it => <option key={it.id} value={it.id}>{it.label} · {it.name}</option>)}
                  </select>
                  <input type="number" min={1} value={line.quantity} onChange={e => setLine(i, 'quantity', e.target.value)}
                    className="w-20 bg-slate-100 border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 transition-colors text-center" />
                  <button type="button" onClick={() => removeLine(i)} className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all flex-shrink-0"><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>
          <ImageUploader
            existingUrls={form.images}
            pendingFiles={pendingFiles}
            onAddFiles={files => setPendingFiles(p => [...p, ...files])}
            onRemoveExisting={handleRemoveExisting}
            onRemovePending={i => setPendingFiles(p => p.filter((_, idx) => idx !== i))}
          />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any handling notes..."
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Uploading…' : isNew ? 'Create Shipment' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShipmentRow({ shipment, events, items, onEdit, onDelete, onConsume }: {
  shipment: WmsShipment; events: WmsData['events']; items: WmsItem[]
  onEdit: (s: WmsShipment) => void; onDelete: (s: WmsShipment) => void; onConsume: (s: WmsShipment) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const event = events.find(e => e.id === shipment.eventId)
  const cfg = TYPE_CONFIG[shipment.type]
  const Icon = cfg.icon
  const totalQty = shipment.items.reduce((a, b) => a + b.quantity, 0)
  const imageCount = shipment.images?.length || 0

  return (
    <>
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      <tr className="border-b border-slate-200 hover:bg-slate-100/50 transition-colors group cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <td className="px-5 py-3.5">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${shipment.type === 'outbound' ? 'bg-blue-500/15 text-blue-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
            <Icon size={10} />{cfg.label}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <p className="text-sm font-medium text-slate-700">{event?.name || 'Unknown Event'}</p>
          {shipment.trackingRef && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Hash size={9} />{shipment.trackingRef}</p>}
        </td>
        <td className="px-5 py-3.5"><span className="text-xs text-slate-500">{shipment.dispatchDate}</span></td>
        <td className="px-5 py-3.5"><span className="text-xs text-slate-500">{shipment.deliveryDate || '—'}</span></td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5"><Package size={12} className="text-slate-400" /><span className="text-xs text-slate-600">{shipment.items.length} types · {totalQty} units</span></div>
            {imageCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                <ImageIcon size={10} className="text-slate-500" />{imageCount}
              </div>
            )}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLOR[shipment.status]}`}>
            {shipment.status.replace('_', ' ')}
          </span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-slate-600 transition-colors">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {shipment.type === 'outbound' && shipment.status !== 'consumed' && (
              <button onClick={() => onConsume(shipment)} title="Mark as Consumed" className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-orange-600 hover:bg-orange-500/10 transition-all opacity-0 group-hover:opacity-100">
                <PackageX size={12} />
              </button>
            )}
            <button onClick={() => onEdit(shipment)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100"><Edit2 size={12} /></button>
            <button onClick={() => onDelete(shipment)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-200 bg-slate-50">
          <td colSpan={7} className="px-5 py-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {shipment.items.map((line, i) => {
                const item = items.find(it => it.id === line.itemId)
                return (
                  <div key={i} className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] font-mono font-bold text-blue-600">{item?.label || '?'}</span>
                    <span className="text-[10px] text-slate-600">{item?.name || 'Unknown'}</span>
                    <span className="text-[10px] font-bold text-slate-900">× {line.quantity}</span>
                  </div>
                )
              })}
            </div>
            {imageCount > 0 && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Attachments ({imageCount})</p>
                <div className="flex flex-wrap gap-2">
                  {shipment.images.map((url, i) => (
                    <button key={i} onClick={() => setLightbox(url)} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500/60 transition-all group/img">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all flex items-center justify-center">
                        <ZoomIn size={16} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {shipment.notes && <p className="text-xs text-slate-400 italic">Note: {shipment.notes}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

export default function Shipments({ data, addShipment, updateShipment, deleteShipment, updateItem, defaultEventId }: {
  data: WmsData
  addShipment: (s: Partial<WmsShipment>) => Promise<unknown>
  updateShipment: (id: string, s: Partial<WmsShipment>) => Promise<unknown>
  deleteShipment: (id: string) => Promise<unknown>
  updateItem: (id: string, changes: Partial<WmsItem>) => Promise<unknown>
  defaultEventId?: string
}) {
  const { shipments, events, items } = data
  const [modal, setModal] = useState<WmsShipment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WmsShipment | null>(null)
  const [consumeTarget, setConsumeTarget] = useState<WmsShipment | null>(null)
  const [consumeSaving, setConsumeSaving] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState(defaultEventId || 'all')

  const filtered = useMemo(() =>
    shipments
      .filter(s => typeFilter === 'all' || s.type === typeFilter)
      .filter(s => statusFilter === 'all' || s.status === statusFilter)
      .filter(s => eventFilter === 'all' || s.eventId === eventFilter)
      .sort((a, b) => b.dispatchDate.localeCompare(a.dispatchDate)),
    [shipments, typeFilter, statusFilter, eventFilter]
  )

  const handleSave = async (form: WmsShipment) => {
    if (form.id) await updateShipment(form.id, form)
    else await addShipment(form)
    setModal(null)
  }

  const handleConsume = async () => {
    if (!consumeTarget) return
    setConsumeSaving(true)
    for (const line of consumeTarget.items) {
      const item = items.find(i => i.id === line.itemId)
      if (item) await updateItem(item.id, { quantity: Math.max(0, item.quantity - line.quantity) })
    }
    await updateShipment(consumeTarget.id, { ...consumeTarget, status: 'consumed' })
    setConsumeSaving(false)
    setConsumeTarget(null)
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {modal && <ShipmentModal shipment={modal} data={data} onSave={handleSave} onClose={() => setModal(null)} />}
      {consumeTarget && <ConsumeModal shipment={consumeTarget} items={items} saving={consumeSaving} onConfirm={handleConsume} onCancel={() => setConsumeTarget(null)} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-rose-500" /></div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Delete Shipment?</h3>
            <p className="text-xs text-slate-500 mb-6">This shipment record will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => { deleteShipment(deleteTarget.id); setDeleteTarget(null) }} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Shipments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {shipments.length} shipments · {shipments.filter(s => s.type === 'outbound').length} outbound, {shipments.filter(s => s.type === 'inbound').length} returns
          </p>
        </div>
        <button onClick={() => setModal({ ...EMPTY_SHIPMENT, eventId: defaultEventId || '' })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-500/20">
          <Plus size={15} /> New Shipment
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {[['all', 'All Types'], ['outbound', 'Outbound'], ['inbound', 'Returns']].map(([v, l]) => (
            <button key={v} onClick={() => setTypeFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${typeFilter === v ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-blue-500 transition-colors">
          <option value="all">All Events</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-blue-500 transition-colors">
          <option value="all">All Statuses</option>
          {SHIPMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {['Type', 'Event', 'Dispatch Date', 'Delivery Date', 'Items', 'Status', ''].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-sm text-slate-400">No shipments found</td></tr>}
            {filtered.map(s => (
              <ShipmentRow key={s.id} shipment={s} events={events} items={items}
                onEdit={s => setModal({ ...s })} onDelete={setDeleteTarget} onConsume={setConsumeTarget} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
