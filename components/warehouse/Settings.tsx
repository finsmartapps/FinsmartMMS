'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings2, Mail, User, Truck, ToggleLeft, KeyRound, CheckCircle, Loader2, Eye, EyeOff, X } from 'lucide-react'

interface WarehouseUser {
  id: string
  name: string
  email: string
  is_active: boolean
}

function PasswordForm({ user, onClose }: { user: WarehouseUser; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setErrorMsg('Password must be at least 6 characters.'); return }
    setStatus('loading')
    setErrorMsg('')
    const res = await fetch('/api/admin/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    })
    const json = await res.json()
    if (!res.ok) {
      setErrorMsg(json.error || 'Something went wrong.')
      setStatus('error')
    } else {
      setStatus('done')
      setTimeout(onClose, 2500)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-indigo-700">Set new password for {user.name}</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      </div>

      {status === 'done' ? (
        <div className="flex items-center gap-2 py-2 text-emerald-700">
          <CheckCircle size={16} />
          <span className="text-sm font-semibold">Password updated successfully!</span>
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
              placeholder="New password (min. 6 characters)"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 pr-10 transition"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={status === 'loading'}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {status === 'loading' && <Loader2 size={12} className="animate-spin" />}
              {status === 'loading' ? 'Saving…' : 'Set Password'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-white text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </form>
  )
}

export default function WarehouseSettings() {
  const [warehouseUsers, setWarehouseUsers] = useState<WarehouseUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFormId, setActiveFormId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, name, email, is_active')
      .eq('role', 'warehouse_user')
      .order('name')
      .then(({ data }) => {
        setWarehouseUsers(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">System configuration and preferences</p>
      </div>

      {/* Warehouse Users */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Warehouse Manager</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Warehouse partners who handle physical shipments.</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : warehouseUsers.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No warehouse users found. Add one via Admin → Users & Access.</p>
          ) : (
            warehouseUsers.map(user => (
              <div key={user.id}>
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Truck size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${user.is_active ? 'text-emerald-600 bg-emerald-500/10' : 'text-slate-400 bg-slate-100'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {activeFormId !== user.id && (
                    <button
                      onClick={() => setActiveFormId(user.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 ring-1 ring-slate-200 hover:ring-indigo-200 transition-colors"
                    >
                      <KeyRound size={12} /> Set Password
                    </button>
                  )}
                </div>
                {activeFormId === user.id && (
                  <div className="mt-2">
                    <PasswordForm user={user} onClose={() => setActiveFormId(null)} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Email Notifications */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Email Notifications</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Automatically notify warehouse users when new shipment orders are created.</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          {warehouseUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between py-3.5 px-4 rounded-xl bg-slate-50 border border-slate-200 opacity-60 cursor-not-allowed select-none">
              <div>
                <p className="text-sm font-medium text-slate-700">Email alerts to {user.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user.email} · New outbound shipment orders</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Coming soon</span>
                <div className="w-10 h-6 rounded-full bg-slate-200 relative">
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 flex items-start gap-1.5 px-1">
            <ToggleLeft size={13} className="flex-shrink-0 mt-0.5" />
            Email alerts will be enabled once the system is fully configured.
          </p>
        </div>
      </div>

      {/* Admin Account */}
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
