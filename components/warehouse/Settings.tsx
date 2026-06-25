'use client'
import { Settings2, Mail, User, Truck, ToggleLeft } from 'lucide-react'

export default function WarehouseSettings() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">System configuration and preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Warehouse Manager</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">The GTL Delivers contact who handles physical shipments.</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Truck size={16} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Mike</p>
              <p className="text-xs text-slate-400">mike@gtldelivers.com · GTL Delivers</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">Active</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Email Notifications</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Automatically notify Mike when new shipment orders are created.</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="flex items-center justify-between py-3.5 px-4 rounded-xl bg-slate-50 border border-slate-200 opacity-60 cursor-not-allowed select-none">
            <div>
              <p className="text-sm font-medium text-slate-700">Email alerts to Mike</p>
              <p className="text-xs text-slate-400 mt-0.5">mike@gtldelivers.com · New outbound shipment orders</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Coming soon</span>
              <div className="w-10 h-6 rounded-full bg-slate-200 relative">
                <div className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 flex items-start gap-1.5 px-1">
            <ToggleLeft size={13} className="flex-shrink-0 mt-0.5" />
            Email alerts will be enabled once the system is fully configured.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Admin Account</h3>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">F</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Finsmart</p>
              <p className="text-xs text-slate-400">chirag.p@finsmartaccounting.com · Administrator</p>
            </div>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-full">Admin</span>
          </div>
        </div>
      </div>
    </div>
  )
}
