'use client'
import { useState, useMemo, useRef } from 'react'
import {
  Package, Plus, Search, Edit2, Trash2, X, AlertTriangle, CheckCircle2,
  Tag, MapPin, Send, ImagePlus, Image as ImageIcon, Loader2, ZoomIn, FileDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { downloadXls } from '@/lib/warehouse/exportXls'
import { CATEGORIES, getNextLabel, type WmsItem, type WmsData } from './useWarehouseStore'

const OUT_STATUSES = new Set(['in_transit', 'delivered', 'at_event', 'return_pending'])

function computeItemsOut(shipments: WmsData['shipments']): Record<string, number> {
  const out: Record<string, number> = {}
  shipments
    .filter(s => s.type === 'outbound' && OUT_STATUSES.has(s.status))
    .forEach(s => s.items.forEach(({ itemId, quantity }) => {
      out[itemId] = (out[itemId] || 0) + quantity
    }))
  return out
}

const EMPTY_ITEM: WmsItem = {
  id: '', label: '', name: '', category: 'Swag', description: '',
  quantity: 0, unit: 'pcs', minStock: 5, notes: '', location: '', images: [], createdAt: '',
}

async function uploadItemImages(files: File[], itemId: string): Promise<string[]> {
  const supabase = createClient()
  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop()
    const path = `${itemId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('wms-item-images').upload(path, file, { upsert: false })
    if (!error) {
      const { data } = supabase.storage.from('wms-item-images').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
  }
  return urls
}

async function deleteItemImage(url: string) {
  const supabase = createClient()
  const path = url.split('/wms-item-images/')[1]
  if (path) await supabase.storage.from('wms-item-images').remove([path])
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors">
        <X size={18} />
      </button>
      <img src={url} alt="Item photo" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  )
}

function ImageUploader({ existingUrls, pendingFiles, onAddFiles, onRemoveExisting, onRemovePending }: {
  existingUrls: string[]; pendingFiles: File[]
  onAddFiles: (files: File[]) => void
  onRemoveExisting: (i: number) => void
  onRemovePending: (i: number) => void
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
        <label className="text-xs font-medium text-slate-500">Photos</label>
        <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-500 transition-colors">
          <ImagePlus size={13} /> Add Photos
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePick} />
      </div>
      {(existingUrls.length > 0 || pendingFiles.length > 0) ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {existingUrls.map((url, i) => (
            <div key={url} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onRemoveExisting(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
          {pendingFiles.map((file, i) => (
            <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-blue-500/40">
              <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-blue-900/20" />
              <button type="button" onClick={() => onRemovePending(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full border border-dashed border-slate-200 rounded-lg py-4 flex flex-col items-center gap-2 text-slate-400 hover:border-blue-500/50 hover:text-slate-500 transition-all">
          <ImageIcon size={18} />
          <span className="text-xs">Click to attach photos of this item</span>
        </button>
      )}
    </div>
  )
}

function ItemModal({ item, items, onSave, onClose }: {
  item: WmsItem; items: WmsItem[]
  onSave: (form: WmsItem) => void; onClose: () => void
}) {
  const isNew = !item.id
  const [form, setForm] = useState({ ...item, images: [...(item.images || [])] })
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.label.trim()) e.label = 'Label required'
    if (!form.name.trim()) e.name = 'Name required'
    if (form.quantity < 0) e.quantity = 'Must be ≥ 0'
    if (isNew && items.some(i => i.label === form.label.trim())) e.label = 'Label already exists'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const itemId = form.id || `new-${Date.now()}`
    const newUrls = pendingFiles.length > 0 ? await uploadItemImages(pendingFiles, itemId) : []
    onSave({ ...form, quantity: Number(form.quantity), minStock: Number(form.minStock), images: [...form.images, ...newUrls] })
  }

  const handleRemoveExisting = async (i: number) => {
    const url = form.images[i]
    await deleteItemImage(url)
    setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">{isNew ? 'Add New Item' : 'Edit Item'}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"><X size={14} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Label *</label>
              <input value={form.label} onChange={e => set('label', e.target.value.toUpperCase())} placeholder="CP-101"
                className={`w-full bg-slate-100 border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors ${errors.label ? 'border-rose-500' : 'border-slate-200'}`} />
              {errors.label && <p className="text-[10px] text-rose-500 mt-1">{errors.label}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Item Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Standee Banners"
              className={`w-full bg-slate-100 border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors ${errors.name ? 'border-rose-500' : 'border-slate-200'}`} />
            {errors.name && <p className="text-[10px] text-rose-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description..." rows={2}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Quantity</label>
              <input type="number" min={0} value={form.quantity} onChange={e => set('quantity', e.target.value)}
                className={`w-full bg-slate-100 border rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors ${errors.quantity ? 'border-rose-500' : 'border-slate-200'}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Unit</label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="pcs"
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Min Stock</label>
              <input type="number" min={0} value={form.minStock} onChange={e => set('minStock', e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Location in Warehouse</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Shelf A3, Bay 2"
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Handling notes..."
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors" />
          </div>
          <ImageUploader
            existingUrls={form.images}
            pendingFiles={pendingFiles}
            onAddFiles={files => setPendingFiles(f => [...f, ...files])}
            onRemoveExisting={handleRemoveExisting}
            onRemovePending={i => setPendingFiles(f => f.filter((_, idx) => idx !== i))}
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-70">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {isNew ? 'Add Item' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

const CAT_COLORS: Record<string, string> = {
  Swag: 'bg-blue-500/15 text-blue-600', Display: 'bg-emerald-500/15 text-emerald-600',
  Print: 'bg-amber-500/15 text-amber-600', Packaging: 'bg-purple-500/15 text-purple-600',
  Electronics: 'bg-cyan-500/15 text-cyan-600', Furniture: 'bg-rose-500/15 text-rose-500',
  Other: 'bg-slate-100 text-slate-600',
}

export default function Inventory({ data, addItem, updateItem, deleteItem }: {
  data: WmsData
  addItem: (item: Partial<WmsItem>) => Promise<unknown>
  updateItem: (id: string, changes: Partial<WmsItem>) => Promise<unknown>
  deleteItem: (id: string) => Promise<unknown>
}) {
  const { items, shipments, events } = data
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [modal, setModal] = useState<WmsItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WmsItem | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const itemsOut = useMemo(() => computeItemsOut(shipments), [shipments])

  const filtered = items.filter(item => {
    const q = search.toLowerCase()
    const matchSearch = !q || item.label.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    const matchCat = catFilter === 'All' || item.category === catFilter
    return matchSearch && matchCat
  })

  const handleSave = (form: WmsItem) => {
    if (form.id) updateItem(form.id, form)
    else addItem(form)
    setModal(null)
  }

  const handleExport = () => {
    const invHeaders = ['Label', 'Name', 'Category', 'Total Qty', 'Available', 'Unit', 'Location', 'Min Stock', 'Notes', 'Status']
    const invRows = items.map(item => {
      const out = itemsOut[item.id] || 0
      const available = Math.max(0, item.quantity - out)
      const allOut = out >= item.quantity && out > 0
      const partialOut = out > 0 && !allOut
      const low = available <= item.minStock && !allOut
      const status = allOut ? 'At Event' : partialOut ? 'Partial Out' : low ? 'Low Stock' : 'In Stock'
      return [item.label, item.name, item.category, item.quantity, available, item.unit, item.location || '', item.minStock, item.notes || '', status]
    })
    const QUEUE_STATUSES = new Set(['pending', 'in_transit'])
    const queueShipments = shipments.filter(s => s.type === 'outbound' && QUEUE_STATUSES.has(s.status))
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]))
    const eventMap = Object.fromEntries(events.map(e => [e.id, e]))
    const queueHeaders = ['Event', 'Status', 'Dispatch Date', 'Item Label', 'Item Name', 'Qty', 'Tracking Ref']
    const queueRows = queueShipments.flatMap(s =>
      s.items.map(({ itemId, quantity }) => {
        const item = itemMap[itemId] || {}
        const event = eventMap[s.eventId] || {}
        return [(event as WmsData['events'][0]).name || '—', s.status, s.dispatchDate || '—', (item as WmsItem).label || '—', (item as WmsItem).name || '—', quantity, s.trackingRef || '—']
      })
    )
    if (queueRows.length === 0) queueRows.push(['No items in shipping queue', '', '', '', '', '', ''])
    const today = new Date().toISOString().split('T')[0]
    downloadXls(
      [{ name: 'Inventory', headers: invHeaders, rows: invRows }, { name: 'Shipping Queue', headers: queueHeaders, rows: queueRows }],
      `finsmart-inventory-${today}.xls`
    )
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      {modal && <ItemModal item={modal} items={items} onSave={handleSave} onClose={() => setModal(null)} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-rose-500" /></div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Delete Item?</h3>
            <p className="text-xs text-slate-500 mb-6">{deleteTarget.label} · {deleteTarget.name} will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => { deleteItem(deleteTarget.id); setDeleteTarget(null) }} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} items · {items.reduce((a, b) => a + Math.max(0, b.quantity - (itemsOut[b.id] || 0)), 0)} available
            {Object.values(itemsOut).some(v => v > 0) && <span className="ml-2 text-amber-600">· {Object.values(itemsOut).reduce((a, b) => a + b, 0)} out at event</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all">
            <FileDown size={15} /> Export XLS
          </button>
          <button onClick={() => setModal({ ...EMPTY_ITEM, label: getNextLabel(items) })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-500/20">
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by label, name..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['All', ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${catFilter === cat ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {['Label', 'Name', 'Category', 'Qty', 'Location', 'Status', 'Notes', ''].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-slate-400">No items found</td></tr>
            )}
            {filtered.map(item => {
              const out = itemsOut[item.id] || 0
              const available = Math.max(0, item.quantity - out)
              const allOut = out >= item.quantity && out > 0
              const partialOut = out > 0 && !allOut
              const low = available <= item.minStock && !allOut
              return (
                <tr key={item.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-100/50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Tag size={13} className="text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-mono font-bold text-blue-600">{item.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {item.images?.length > 0 ? (
                        <button onClick={() => setLightbox(item.images[0])} className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 group/img">
                          <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn size={12} className="text-white" />
                          </div>
                          {item.images.length > 1 && <span className="absolute bottom-0 right-0 text-[8px] bg-black/60 text-white px-1 rounded-tl">+{item.images.length - 1}</span>}
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <Package size={14} className="text-slate-300" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-700">{item.name}</p>
                        {item.description && <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{item.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[item.category] || 'bg-slate-100 text-slate-600'}`}>{item.category}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`text-sm font-bold ${allOut ? 'text-rose-500' : low ? 'text-amber-600' : 'text-slate-700'}`}>{available}</span>
                    <span className="text-[10px] text-slate-400 ml-1">{item.unit}</span>
                    {out > 0 && <p className="text-[10px] text-slate-400 mt-0.5">{out} out · {item.quantity} total</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    {item.location
                      ? <div className="flex items-center gap-1.5"><MapPin size={11} className="text-slate-400 flex-shrink-0" /><span className="text-xs text-slate-600 truncate max-w-[120px]">{item.location}</span></div>
                      : <span className="text-xs text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {allOut
                      ? <div className="flex items-center gap-1.5"><Send size={11} className="text-rose-500" /><span className="text-[10px] text-rose-500">At Event</span></div>
                      : partialOut
                        ? <div className="flex items-center gap-1.5"><Send size={11} className="text-amber-600" /><span className="text-[10px] text-amber-600">Partial Out</span></div>
                        : low
                          ? <div className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-600" /><span className="text-[10px] text-amber-600">Low stock</span></div>
                          : <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /><span className="text-[10px] text-emerald-600">In stock</span></div>}
                  </td>
                  <td className="px-5 py-3.5"><span className="text-xs text-slate-400 truncate max-w-[120px] block">{item.notes || '—'}</span></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModal({ ...item })} className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 hover:text-white hover:bg-blue-600 transition-all"><Edit2 size={12} /></button>
                      <button onClick={() => setDeleteTarget(item)} className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 hover:text-white hover:bg-rose-600 transition-all"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
