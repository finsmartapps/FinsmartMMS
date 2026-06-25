'use client'
import { Loader2 } from 'lucide-react'
import { useWarehouseStore } from '@/components/warehouse/useWarehouseStore'
import Reports from '@/components/warehouse/Reports'

export default function WarehouseReportsPage() {
  const { data, loading, error } = useWarehouseStore()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin text-slate-400" />
    </div>
  )
  if (error) return (
    <div className="p-6 text-sm text-rose-500">Failed to load reports: {error}</div>
  )

  return (
    <div className="p-6">
      <Reports data={data} />
    </div>
  )
}
