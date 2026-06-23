'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ListTodo, Phone, Mail, Building2, CalendarDays,
  CheckCircle2, Clock, Search, Loader2, AlertCircle, Users, Filter,
} from 'lucide-react'
import { formatShortDate } from '@/lib/utils'

interface Telecaller { id: string; name: string }

interface FollowUp {
  id: string
  user_id: string
  first_name: string
  last_name: string
  company_name: string | null
  phone: string | null
  email: string | null
  follow_up_date: string
  notes: string | null
  status: 'pending' | 'done'
  created_at: string
  profiles: { id: string; name: string } | null
}

interface Stats { total: number; pending: number; done: number; overdue: number }

const today = new Date().toISOString().split('T')[0]

export default function ManagerFollowUpsPage() {
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [stats, setStats]         = useState<Stats>({ total: 0, pending: 0, done: 0, overdue: 0 })
  const [telecallers, setTelecallers] = useState<Telecaller[]>([])
  const [loading, setLoading]     = useState(true)

  // Filters
  const [search,    setSearch]    = useState('')
  const [userId,    setUserId]    = useState('')
  const [status,    setStatus]    = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  const load = useCallback(async (s = search, uid = userId, st = status, df = dateFrom, dt = dateTo) => {
    setLoading(true)
    const q = new URLSearchParams()
    if (s)   q.set('search', s)
    if (uid) q.set('user_id', uid)
    if (st)  q.set('status', st)
    if (df)  q.set('date_from', df)
    if (dt)  q.set('date_to', dt)
    const res  = await fetch(`/api/manager/followups?${q}`)
    const data = await res.json()
    setFollowups(data.followups ?? [])
    setStats(data.stats ?? { total: 0, pending: 0, done: 0, overdue: 0 })
    setTelecallers(data.telecallers ?? [])
    setLoading(false)
  }, [search, userId, status, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function clearFilters() {
    setSearch(''); setUserId(''); setStatus(''); setDateFrom(''); setDateTo('')
  }
  const hasFilters = !!(search || userId || status || dateFrom || dateTo)

  const selectCls = 'border border-[#E5E5EA] rounded-xl px-3 py-2 text-sm text-[#6E6E73] focus:outline-none focus:border-[#DC2626] transition bg-white'
  const inputCls  = 'border border-[#E5E5EA] rounded-xl px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] transition bg-white'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Team Callbacks</h1>
        <p className="text-[#6E6E73] text-sm mt-0.5">All callback reminders logged by your telecallers</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: stats.total,   icon: Users,        color: 'bg-[#DC2626]' },
          { label: 'Pending',  value: stats.pending,  icon: Clock,        color: 'bg-[#FF9500]' },
          { label: 'Overdue',  value: stats.overdue,  icon: AlertCircle,  color: 'bg-[#FF3B30]' },
          { label: 'Called Back', value: stats.done,  icon: CheckCircle2, color: 'bg-[#34C759]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#E5E5EA] px-4 py-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-lg ${color} flex items-center justify-center`}>
                <Icon size={12} className="text-white" />
              </div>
              <p className="text-[12px] text-[#6E6E73] font-medium">{label}</p>
            </div>
            <p className="text-[24px] font-bold text-[#1D1D1F] leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] px-5 py-4 space-y-3"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Filter size={13} className="text-[#AEAEB2]" />
          <p className="text-[12px] font-semibold text-[#6E6E73] uppercase tracking-wider">Filters</p>
          {hasFilters && (
            <button onClick={clearFilters}
              className="ml-auto text-[12px] text-[#DC2626] hover:underline font-medium">
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, company…"
              className={`${inputCls} pl-8 w-full`}
            />
          </div>

          {/* Telecaller */}
          <select value={userId} onChange={e => { setUserId(e.target.value); load(search, e.target.value, status, dateFrom, dateTo) }}
            className={selectCls}>
            <option value="">All telecallers</option>
            {telecallers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* Status */}
          <select value={status} onChange={e => { setStatus(e.target.value); load(search, userId, e.target.value, dateFrom, dateTo) }}
            className={selectCls}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="done">Called Back</option>
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); load(search, userId, status, e.target.value, dateTo) }}
              className={`${inputCls} flex-1 min-w-0`} title="From date" />
            <span className="text-[#AEAEB2] text-[12px] flex-shrink-0">to</span>
            <input type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); load(search, userId, status, dateFrom, e.target.value) }}
              className={`${inputCls} flex-1 min-w-0`} title="To date" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
        <div className="px-5 py-3.5 border-b border-[#F2F2F7]">
          <p className="text-[14px] font-semibold text-[#1D1D1F]">
            Callbacks <span className="text-[#AEAEB2] font-normal text-[13px]">({followups.length})</span>
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-[#DC2626]" />
          </div>
        ) : followups.length === 0 ? (
          <div className="py-16 text-center">
            <ListTodo size={36} className="mx-auto text-[#E5E5EA] mb-3" />
            <p className="font-semibold text-[#6E6E73]">
              {hasFilters ? 'No callbacks match your filters' : 'No callbacks logged yet'}
            </p>
            <p className="text-[13px] text-[#AEAEB2] mt-1">
              {hasFilters ? 'Try adjusting the filters above.' : 'Telecallers add callbacks from their Callbacks page.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ minWidth: 820 }}>
              <thead>
                <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
                  {['Contact', 'Company', 'Phone / Email', 'Call Back On', 'Notes', 'Status', 'Telecaller'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F2F7]">
                {followups.map(f => {
                  const isDone    = f.status === 'done'
                  const isOverdue = !isDone && f.follow_up_date < today
                  const isDueToday = !isDone && f.follow_up_date === today
                  return (
                    <tr key={f.id} className={`hover:bg-[#FAFAFA] transition ${isDone ? 'opacity-60' : ''}`}>
                      {/* Contact */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className={`font-semibold ${isDone ? 'line-through text-[#AEAEB2]' : isOverdue ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>
                          {f.first_name} {f.last_name}
                        </p>
                      </td>
                      {/* Company */}
                      <td className="px-4 py-3 max-w-[140px]">
                        {f.company_name
                          ? <span className="flex items-center gap-1 text-[#6E6E73]">
                              <Building2 size={11} className="text-[#AEAEB2] flex-shrink-0" />
                              <span className="truncate">{f.company_name}</span>
                            </span>
                          : <span className="text-[#AEAEB2]">—</span>}
                      </td>
                      {/* Phone / Email */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {f.phone
                            ? <a href={`tel:${f.phone}`} className="flex items-center gap-1.5 text-[#6E6E73] hover:text-[#DC2626] transition">
                                <Phone size={10} className="text-[#AEAEB2]" />{f.phone}
                              </a>
                            : null}
                          {f.email
                            ? <a href={`mailto:${f.email}`} className="flex items-center gap-1.5 text-[#6E6E73] hover:text-[#DC2626] transition">
                                <Mail size={10} className="text-[#AEAEB2]" />
                                <span className="truncate max-w-[140px] block">{f.email}</span>
                              </a>
                            : null}
                          {!f.phone && !f.email && <span className="text-[#AEAEB2]">—</span>}
                        </div>
                      </td>
                      {/* Call Back On */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={11} className={isOverdue ? 'text-[#FF3B30]' : 'text-[#AEAEB2]'} />
                          <span className={`font-medium ${isOverdue ? 'text-[#FF3B30]' : isDone ? 'text-[#AEAEB2]' : 'text-[#1D1D1F]'}`}>
                            {isOverdue ? 'Overdue · ' : ''}{formatShortDate(f.follow_up_date)}
                          </span>
                        </div>
                      </td>
                      {/* Notes */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="text-[12px] text-[#AEAEB2] italic truncate block">{f.notes || '—'}</span>
                      </td>
                      {/* Status badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isDone
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#34C759] bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                              <CheckCircle2 size={10} /> Called Back
                            </span>
                          : isOverdue
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF3B30] bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                              <AlertCircle size={10} /> Overdue
                            </span>
                          : isDueToday
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF9500] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                              <Clock size={10} /> Due Today
                            </span>
                          : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-full border border-[#E5E5EA]">
                              <Clock size={10} /> Pending
                            </span>}
                      </td>
                      {/* Telecaller */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {f.profiles
                          ? <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-[9px] font-bold">{f.profiles.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="text-[#6E6E73]">{f.profiles.name}</span>
                            </div>
                          : <span className="text-[#AEAEB2]">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
