'use client'
import { Loader2 } from 'lucide-react'
import { useWarehouseStore } from './useWarehouseStore'
import Dashboard from './Dashboard'

export default function WarehouseDashboardPage() {
  const { data, loading, error } = useWarehouseStore()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin text-slate-400" />
    </div>
  )
  if (error) return (
    <div className="p-6 text-sm text-rose-500">Failed to load warehouse data: {error}</div>
  )

  return (
    <div className="p-6">
      <Dashboard data={data} />
    </div>
  )
}
