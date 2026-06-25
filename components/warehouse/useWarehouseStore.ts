'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export const CATEGORIES = ['Swag', 'Display', 'Print', 'Packaging', 'Electronics', 'Furniture', 'Other']
export const EVENT_STATUSES = ['upcoming', 'active', 'completed', 'cancelled']
export const SHIPMENT_STATUSES = ['pending', 'packed', 'in_transit', 'delivered', 'at_event', 'return_pending', 'received', 'consumed']

export interface WmsItem {
  id: string
  label: string
  name: string
  category: string
  description: string
  quantity: number
  unit: string
  minStock: number
  notes: string
  location: string
  images: string[]
  createdAt: string
}

export interface WmsEvent {
  id: string
  name: string
  location: string
  startDate: string
  endDate: string
  status: string
  notes: string
}

export interface ShipmentLine {
  itemId: string
  quantity: number
}

export interface WmsShipment {
  id: string
  eventId: string
  type: 'outbound' | 'inbound'
  status: string
  dispatchDate: string
  deliveryDate: string
  trackingRef: string
  notes: string
  items: ShipmentLine[]
  images: string[]
}

export interface WmsData {
  items: WmsItem[]
  events: WmsEvent[]
  shipments: WmsShipment[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToItem(r: any): WmsItem {
  return {
    id: r.id, label: r.label, name: r.name, category: r.category,
    description: r.description || '', quantity: r.quantity, unit: r.unit,
    minStock: r.min_stock, notes: r.notes || '', location: r.location || '',
    images: r.images || [],
    createdAt: r.created_at?.split('T')[0] || '',
  }
}

function itemToDb(item: Partial<WmsItem>) {
  return {
    label: item.label, name: item.name, category: item.category,
    description: item.description || '', quantity: Number(item.quantity),
    unit: item.unit, min_stock: Number(item.minStock), notes: item.notes || '',
    location: item.location || '', images: item.images || [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToEvent(r: any): WmsEvent {
  return {
    id: r.id, name: r.name, location: r.location || '',
    startDate: r.start_date, endDate: r.end_date || '',
    status: r.status, notes: r.notes || '',
  }
}

function eventToDb(ev: Partial<WmsEvent>) {
  return {
    name: ev.name, location: ev.location || '',
    start_date: ev.startDate, end_date: ev.endDate || null,
    status: ev.status, notes: ev.notes || '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToShipment(r: any): WmsShipment {
  return {
    id: r.id, eventId: r.event_id, type: r.type, status: r.status,
    dispatchDate: r.dispatch_date || '', deliveryDate: r.delivery_date || '',
    trackingRef: r.tracking_ref || '', notes: r.notes || '',
    items: r.items || [], images: r.images || [],
  }
}

function shipmentToDb(s: Partial<WmsShipment>) {
  return {
    event_id: s.eventId, type: s.type, status: s.status,
    dispatch_date: s.dispatchDate || null, delivery_date: s.deliveryDate || null,
    tracking_ref: s.trackingRef || '', notes: s.notes || '',
    items: s.items || [], images: s.images || [],
  }
}

export function getNextLabel(items: WmsItem[]): string {
  const nums = items
    .map(i => parseInt(i.label?.replace('CP-', '') || '0'))
    .filter(n => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 100
  return `CP-${String(max + 1).padStart(3, '0')}`
}

export function useWarehouseStore() {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<WmsData>({ items: [], events: [], shipments: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [iRes, eRes, sRes] = await Promise.all([
      supabase.from('wms_items').select('*').is('deleted_at', null).order('label'),
      supabase.from('wms_events').select('*').order('start_date', { ascending: false }),
      supabase.from('wms_shipments').select('*').order('dispatch_date', { ascending: false }),
    ])
    if (iRes.error || eRes.error || sRes.error) {
      setError(iRes.error?.message || eRes.error?.message || sRes.error?.message || 'Unknown error')
      setLoading(false)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const events = (eRes.data || []).map(row => {
      const ev = dbToEvent(row)
      if (ev.status === 'cancelled') return ev

      let autoStatus: string | null = null
      if (ev.endDate && ev.endDate < today && ev.status !== 'completed') autoStatus = 'completed'
      else if (ev.startDate <= today && (!ev.endDate || ev.endDate >= today) && ev.status === 'upcoming') autoStatus = 'active'

      if (autoStatus) {
        supabase.from('wms_events').update({ status: autoStatus }).eq('id', ev.id)
        return { ...ev, status: autoStatus }
      }
      return ev
    })

    setData({
      items: (iRes.data || []).map(dbToItem),
      events,
      shipments: (sRes.data || []).map(dbToShipment),
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => { refresh() }, [refresh])

  const addItem = async (item: Partial<WmsItem>) => {
    const { error } = await supabase.from('wms_items').insert(itemToDb(item))
    if (!error) await refresh()
    return error
  }

  const updateItem = async (id: string, changes: Partial<WmsItem>) => {
    const row: Record<string, unknown> = {}
    if (changes.label !== undefined) row.label = changes.label
    if (changes.name !== undefined) row.name = changes.name
    if (changes.category !== undefined) row.category = changes.category
    if (changes.description !== undefined) row.description = changes.description
    if (changes.quantity !== undefined) row.quantity = Number(changes.quantity)
    if (changes.unit !== undefined) row.unit = changes.unit
    if (changes.minStock !== undefined) row.min_stock = Number(changes.minStock)
    if (changes.notes !== undefined) row.notes = changes.notes
    if (changes.location !== undefined) row.location = changes.location
    if (changes.images !== undefined) row.images = changes.images
    const { error } = await supabase.from('wms_items').update(row).eq('id', id)
    if (!error) await refresh()
    return error
  }

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('wms_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (!error) await refresh()
    return error
  }

  const addEvent = async (event: Partial<WmsEvent>) => {
    const { error } = await supabase.from('wms_events').insert(eventToDb(event))
    if (!error) await refresh()
    return error
  }

  const updateEvent = async (id: string, changes: Partial<WmsEvent>) => {
    const { error } = await supabase.from('wms_events').update(eventToDb(changes)).eq('id', id)
    if (!error) await refresh()
    return error
  }

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from('wms_events').delete().eq('id', id)
    if (!error) await refresh()
    return error
  }

  const addShipment = async (shipment: Partial<WmsShipment>) => {
    const { error } = await supabase.from('wms_shipments').insert(shipmentToDb(shipment))
    if (!error) await refresh()
    return error
  }

  const updateShipment = async (id: string, changes: Partial<WmsShipment>) => {
    const { error } = await supabase.from('wms_shipments').update(shipmentToDb(changes)).eq('id', id)
    if (!error) await refresh()
    return error
  }

  const deleteShipment = async (id: string) => {
    const { error } = await supabase.from('wms_shipments').delete().eq('id', id)
    if (!error) await refresh()
    return error
  }

  return {
    data, loading, error,
    addItem, updateItem, deleteItem,
    addEvent, updateEvent, deleteEvent,
    addShipment, updateShipment, deleteShipment,
  }
}
