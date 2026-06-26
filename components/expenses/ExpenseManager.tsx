'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import type { Expense } from '@/lib/expenses/types'

const supabase = createClient()

type FileEntry = { file: File; preview: string }

function currSymbol(c: 'USD' | 'INR') { return c === 'USD' ? '$' : '₹' }

function sortByDate(list: Expense[]) {
  return [...list].sort((a, b) => {
    const d = b.expense_date.localeCompare(a.expense_date)
    return d !== 0 ? d : b.created_at.localeCompare(a.created_at)
  })
}

function fmtAmt(n: number) { return n.toFixed(2) }

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtDateGroup(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

async function uploadFiles(files: File[]): Promise<string[]> {
  return Promise.all(files.map(async file => {
    const ext      = file.name.split('.').pop() ?? 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    await supabase.storage.from('travel-receipts').upload(fileName, file, { upsert: false })
    return supabase.storage.from('travel-receipts').getPublicUrl(fileName).data.publicUrl
  }))
}

// ── EXPORT XLS ────────────────────────────────────────────────────
function exportXLS(expenses: Expense[]) {
  if (!expenses.length) return
  const rows = expenses.map(e => ({
    'Date':             fmtDate(e.expense_date),
    'City':             (CITIES as Record<string, { label: string }>)[e.city]?.label ?? e.city,
    'Added By':         e.added_by || '',
    'Description':      e.description,
    'Category':         e.category.replace(/^\p{Emoji}\s*/u, ''),
    'Amount':           e.amount,
    'Currency':         e.currency,
    'INR on Card (₹)': e.currency === 'USD' ? (e.inr_equivalent ?? '') : e.amount,
    'Notes':            e.notes || '',
    'Receipts':         e.receipt_urls?.length ? `${e.receipt_urls.length} photo(s)` : 'No',
  }))
  const usdExp = expenses.filter(e => e.currency === 'USD')
  const inrExp = expenses.filter(e => e.currency === 'INR')
  const totalINRReimburse =
    inrExp.reduce((s, e) => s + e.amount, 0) +
    usdExp.filter(e => e.inr_equivalent).reduce((s, e) => s + (e.inr_equivalent ?? 0), 0)
  const summaryRows = [
    { Label: 'Total USD Expenses',       Value: `$${usdExp.reduce((s, e) => s + e.amount, 0).toFixed(2)}`, Count: usdExp.length },
    { Label: 'Total INR Expenses',       Value: `₹${inrExp.reduce((s, e) => s + e.amount, 0).toFixed(2)}`, Count: inrExp.length },
    { Label: 'Total INR to Reimburse',   Value: `₹${totalINRReimburse.toFixed(2)}`,                        Count: '' },
    { Label: 'USD receipts pending INR', Value: '',                                                          Count: usdExp.filter(e => !e.inr_equivalent).length },
    { Label: 'Total receipts',           Value: '',                                                          Count: expenses.length },
  ]
  const wb  = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(rows)
  ws1['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 32 }, { wch: 22 }, { wch: 10 }, { wch: 9 }, { wch: 16 }, { wch: 28 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Expenses')
  const ws2 = XLSX.utils.json_to_sheet(summaryRows)
  ws2['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary')
  XLSX.writeFile(wb, `travel-expenses-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── DOWNLOAD ALL RECEIPTS ─────────────────────────────────────────
async function downloadAllReceipts(
  expenses: Expense[],
  showToast: (msg: string, type?: string) => void,
  setDownloading: (v: boolean) => void,
) {
  const withReceipts = expenses.filter(e => e.receipt_urls?.length)
  if (!withReceipts.length) { showToast('No receipts uploaded yet', 'error'); return }
  const total = withReceipts.reduce((s, e) => s + (e.receipt_urls?.length ?? 0), 0)
  setDownloading(true)
  showToast(`Bundling ${total} photo${total !== 1 ? 's' : ''}…`)
  try {
    const JSZip  = (await import('jszip')).default
    const zip    = new JSZip()
    const folder = zip.folder('receipts')!
    await Promise.all(
      withReceipts.flatMap((e, ei) =>
        (e.receipt_urls ?? []).map(async (url, ri) => {
          const ext      = url.split('?')[0].split('.').pop() ?? 'jpg'
          const city     = e.city === 'lv' ? 'Las-Vegas' : 'Orlando'
          const desc     = e.description.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 28)
          const filename = `${String(ei + 1).padStart(2, '0')}_${e.expense_date}_${city}_${desc}_${ri + 1}.${ext}`
          const blob     = await fetch(url).then(r => r.blob())
          folder.file(filename, blob)
        })
      )
    )
    const blob = await zip.generateAsync({ type: 'blob' })
    const link = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(blob),
      download: `travel-receipts-${new Date().toISOString().slice(0, 10)}.zip`,
    })
    document.body.appendChild(link); link.click()
    document.body.removeChild(link); URL.revokeObjectURL(link.href)
    showToast(`${total} photo${total !== 1 ? 's' : ''} downloaded ✓`, 'success')
  } catch (err) {
    showToast('Download failed — ' + (err instanceof Error ? err.message : 'unknown'), 'error')
  } finally {
    setDownloading(false)
  }
}

// ── CONSTANTS ─────────────────────────────────────────────────────
const CATEGORIES = [
  '🍽️ Meals & Dining', '🏨 Hotel / Accommodation', '✈️ Flights',
  '🚗 Transport / Taxi / Uber', '📋 Conference / Registration',
  '🎁 Client Entertainment', '📦 Office Supplies', '📱 Communication',
  '💊 Medical / Health', '🛍️ Other',
]

const CITIES = {
  lv: { label: 'Las Vegas, NV',  short: 'Las Vegas',  emoji: '🎰', color: '#7b2d8b' },
  or: { label: 'Orlando, FL',    short: 'Orlando',     emoji: '🎡', color: '#1a7a4a' },
  tx: { label: 'Texas, TX',      short: 'Texas',       emoji: '🤠', color: '#c0560a' },
  nj: { label: 'New Jersey, NJ', short: 'New Jersey',  emoji: '🗽', color: '#2471a3' },
} as const
type CityKey = keyof typeof CITIES
type Filter = 'all' | CityKey

const USERS = [
  { name: 'Chirag Patel',    initials: 'CP', color: '#2454a0' },
  { name: 'Piyush Devnani',  initials: 'PD', color: '#7b2d8b' },
  { name: 'Sharvari Gandhi', initials: 'SG', color: '#1a7a4a' },
]

interface FormState {
  desc: string; category: string; amount: string; currency: 'USD' | 'INR'
  date: string; city: string; notes: string; inrEquiv: string
}
const today = () => new Date().toISOString().split('T')[0]
const BLANK: FormState = { desc: '', category: '', amount: '', currency: 'USD', date: today(), city: '', notes: '', inrEquiv: '' }

// ── ROOT ──────────────────────────────────────────────────────────
export default function ExpenseManager({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  return (
    <ExpenseManagerInner currentUser={{
      name: userName,
      initials: userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      isAdmin,
    }} />
  )
}

type AppUser = { name: string; initials: string; isAdmin: boolean }

// ── INNER APP ─────────────────────────────────────────────────────
function ExpenseManagerInner({ currentUser }: { currentUser: AppUser }) {
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState<Filter>('all')
  const [form, setForm]                 = useState<FormState>(BLANK)
  const [receiptFiles, setReceiptFiles] = useState<FileEntry[]>([])
  const [saving, setSaving]             = useState(false)
  const [addOpen, setAddOpen]           = useState(false)
  const [downloading, setDownloading]   = useState(false)
  const [lightbox, setLightbox]         = useState<{ urls: string[]; idx: number } | null>(null)
  const [dragging, setDragging]         = useState(false)
  const [toast, setToast]               = useState<{ msg: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editingExpense, setEditingExpense]     = useState<Expense | null>(null)
  const [editForm, setEditForm]                 = useState<FormState>({ ...BLANK })
  const [editExistingUrls, setEditExistingUrls] = useState<string[]>([])
  const [editNewFiles, setEditNewFiles]         = useState<FileEntry[]>([])
  const [editSaving, setEditSaving]             = useState(false)
  const editFileRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    ;(async () => {
      let query = supabase.from('travel_expenses').select('*')
      if (!currentUser.isAdmin) query = query.eq('added_by', currentUser.name)
      const { data, error } = await query
        .order('expense_date', { ascending: false })
        .order('created_at',   { ascending: false })
      if (!error && data) setExpenses(sortByDate(data as Expense[]))
      else if (error) showToast('Could not load expenses: ' + error.message, 'error')
      setLoading(false)
    })()
  }, [showToast])

  function addFiles(newFiles: File[]) {
    const valid = newFiles.filter(f => {
      if (f.size > 10 * 1024 * 1024) { showToast(`${f.name} skipped (max 10 MB)`, 'error'); return false }
      return true
    })
    setReceiptFiles(prev => [...prev, ...valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
  }

  function removeFile(i: number) {
    setReceiptFiles(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, idx) => idx !== i) })
  }

  function addEditFiles(newFiles: File[]) {
    const valid = newFiles.filter(f => {
      if (f.size > 10 * 1024 * 1024) { showToast(`${f.name} skipped (max 10 MB)`, 'error'); return false }
      return true
    })
    setEditNewFiles(prev => [...prev, ...valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
  }

  function removeEditNewFile(i: number) {
    setEditNewFiles(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, idx) => idx !== i) })
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function addExpense() {
    const { desc, category, amount, currency, date, city, notes } = form
    if (!desc.trim())                       { showToast('Please enter a description', 'error'); return }
    if (!category)                          { showToast('Please select a category', 'error'); return }
    if (!amount || parseFloat(amount) <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (!date)                              { showToast('Please select a date', 'error'); return }
    if (!city)                              { showToast('Please select a city', 'error'); return }

    setSaving(true)
    const receipt_urls = receiptFiles.length > 0 ? await uploadFiles(receiptFiles.map(f => f.file)) : []

    const { data, error } = await supabase
      .from('travel_expenses')
      .insert({
        description: desc.trim(), category, amount: parseFloat(amount), currency,
        expense_date: date, city, notes: notes.trim(), receipt_urls,
        inr_equivalent: (currency === 'USD' && form.inrEquiv) ? parseFloat(form.inrEquiv) : null,
        added_by: currentUser.name, status: 'pending',
      })
      .select().single()

    if (error) {
      showToast('Failed to save: ' + error.message, 'error')
    } else {
      receiptFiles.forEach(f => URL.revokeObjectURL(f.preview))
      setExpenses(prev => sortByDate([data as Expense, ...prev]))
      setForm({ ...BLANK, date: today() })
      setReceiptFiles([])
      setAddOpen(false)
      showToast('Expense added ✓')
    }
    setSaving(false)
  }

  async function deleteExpense(id: string) {
    if (!confirm('Remove this expense?')) return
    const { error } = await supabase.from('travel_expenses').delete().eq('id', id)
    if (!error) { setExpenses(prev => prev.filter(e => e.id !== id)); showToast('Expense removed') }
  }

  function startEdit(expense: Expense) {
    setEditingExpense(expense)
    setEditForm({
      desc: expense.description, category: expense.category, amount: expense.amount.toString(),
      currency: expense.currency, date: expense.expense_date, city: expense.city,
      notes: expense.notes || '', inrEquiv: expense.inr_equivalent ? expense.inr_equivalent.toString() : '',
    })
    setEditExistingUrls(expense.receipt_urls ?? [])
    setEditNewFiles([])
  }

  function closeEdit() {
    editNewFiles.forEach(f => URL.revokeObjectURL(f.preview))
    setEditingExpense(null); setEditNewFiles([]); setEditExistingUrls([])
  }

  async function saveEdit() {
    if (!editingExpense) return
    const { desc, category, amount, currency, date, city, notes } = editForm
    if (!desc.trim())                       { showToast('Please enter a description', 'error'); return }
    if (!category)                          { showToast('Please select a category', 'error'); return }
    if (!amount || parseFloat(amount) <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (!date)                              { showToast('Please select a date', 'error'); return }
    if (!city)                              { showToast('Please select a city', 'error'); return }

    setEditSaving(true)
    const newUrls      = editNewFiles.length > 0 ? await uploadFiles(editNewFiles.map(f => f.file)) : []
    const receipt_urls = [...editExistingUrls, ...newUrls]

    const { data, error } = await supabase
      .from('travel_expenses')
      .update({
        description: desc.trim(), category, amount: parseFloat(amount), currency,
        expense_date: date, city, notes: notes.trim(), receipt_urls,
        inr_equivalent: (editForm.currency === 'USD' && editForm.inrEquiv) ? parseFloat(editForm.inrEquiv) : null,
      })
      .eq('id', editingExpense.id).select().single()

    if (error) {
      showToast('Failed to update: ' + error.message, 'error')
    } else {
      setExpenses(prev => sortByDate(prev.map(e => e.id === editingExpense.id ? data as Expense : e)))
      closeEdit(); showToast('Expense updated ✓')
    }
    setEditSaving(false)
  }

  // ── Computed ──
  const filtered    = filter === 'all' ? expenses : expenses.filter(e => e.city === filter)
  const usdExp      = expenses.filter(e => e.currency === 'USD')
  const inrExp      = expenses.filter(e => e.currency === 'INR')
  const totalUSD    = usdExp.reduce((s, e) => s + e.amount, 0)
  const totalINR    = inrExp.reduce((s, e) => s + e.amount, 0)
  const totalPhotos = expenses.reduce((s, e) => s + (e.receipt_urls?.length ?? 0), 0)
  const totalINRReimburse =
    inrExp.reduce((s, e) => s + e.amount, 0) +
    usdExp.filter(e => e.inr_equivalent).reduce((s, e) => s + (e.inr_equivalent ?? 0), 0)
  const pendingINR  = usdExp.filter(e => !e.inr_equivalent).length

  const expensesByDate = filtered.reduce<Record<string, Expense[]>>((acc, e) => {
    (acc[e.expense_date] ??= []).push(e); return acc
  }, {})
  const dateKeys = Object.keys(expensesByDate).sort((a, b) => b.localeCompare(a))

  return (
    <>
      <div className="print-header">
        <h2 style={{ fontSize: 22, color: '#1a3c6e' }}>Business Trip Expense Report — US 2026</h2>
        <p style={{ color: '#6b7897', marginTop: 4 }}>Las Vegas &amp; Orlando | Prepared for Finance Reimbursement</p>
      </div>

      {/* PAGE HEADER */}
      <div className="exp-page-header">
        <div className="exp-page-title">
          <div className="exp-icon-wrap">✈️</div>
          <div>
            <h2 className="exp-page-heading">Travel Expenses</h2>
            <span className="exp-page-sub">US Business Trip — June 2026 · Las Vegas &amp; Orlando</span>
          </div>
        </div>
        <div className="exp-page-actions">
          <button className="exp-action-btn" disabled={downloading || totalPhotos === 0}
            onClick={() => downloadAllReceipts(expenses, showToast, setDownloading)}>
            {downloading ? '⏳ Bundling…' : `📎 Receipts (${totalPhotos})`}
          </button>
          <button className="exp-action-btn" onClick={() => exportXLS(expenses)} disabled={!expenses.length}>
            📊 Export XLS
          </button>
          <button className="exp-action-btn" onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>

      <div className="exp-main">

        {/* SUMMARY STATS */}
        <div className="exp-stats-row">
          <div className="exp-stat exp-stat-primary">
            <div className="exp-stat-label">Total (USD)</div>
            <div className="exp-stat-value">${fmtAmt(totalUSD)}</div>
            <div className="exp-stat-sub">{usdExp.length} USD expense{usdExp.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="exp-stat exp-stat-amber">
            <div className="exp-stat-label">Total (INR)</div>
            <div className="exp-stat-value">₹{fmtAmt(totalINR)}</div>
            <div className="exp-stat-sub">{inrExp.length} INR expense{inrExp.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="exp-stat exp-stat-purple">
            <div className="exp-stat-label">Las Vegas</div>
            <div className="exp-stat-value">{expenses.filter(e => e.city === 'lv').length}</div>
            <div className="exp-stat-sub">receipt{expenses.filter(e => e.city === 'lv').length !== 1 ? 's' : ''}</div>
          </div>
          <div className="exp-stat exp-stat-green">
            <div className="exp-stat-label">Orlando</div>
            <div className="exp-stat-value">{expenses.filter(e => e.city === 'or').length}</div>
            <div className="exp-stat-sub">receipt{expenses.filter(e => e.city === 'or').length !== 1 ? 's' : ''}</div>
          </div>
          <div className="exp-stat exp-stat-orange">
            <div className="exp-stat-label">Texas</div>
            <div className="exp-stat-value">{expenses.filter(e => e.city === 'tx').length}</div>
            <div className="exp-stat-sub">receipt{expenses.filter(e => e.city === 'tx').length !== 1 ? 's' : ''}</div>
          </div>
          <div className="exp-stat exp-stat-blue">
            <div className="exp-stat-label">New Jersey</div>
            <div className="exp-stat-value">{expenses.filter(e => e.city === 'nj').length}</div>
            <div className="exp-stat-sub">receipt{expenses.filter(e => e.city === 'nj').length !== 1 ? 's' : ''}</div>
          </div>
          <div className="exp-stat exp-stat-indigo">
            <div className="exp-stat-label">Total Receipts</div>
            <div className="exp-stat-value">{expenses.length}</div>
            <div className="exp-stat-sub">{usdExp.length} USD · {inrExp.length} INR</div>
          </div>
          <div className="exp-stat exp-stat-teal">
            <div className="exp-stat-label">Total INR to Reimburse</div>
            <div className="exp-stat-value exp-stat-value-sm">₹{fmtAmt(totalINRReimburse)}</div>
            <div className="exp-stat-sub">
              {pendingINR > 0 ? `${pendingINR} USD rate pending` : 'All card rates filled ✓'}
            </div>
          </div>
        </div>

        {/* EXPENSE CARD */}
        <div className="exp-card">
          {/* Toolbar */}
          <div className="exp-card-toolbar">
            <div className="exp-toolbar-left">
              <span className="exp-card-title">Expense Records</span>
              {!loading && <span className="exp-count-badge">{filtered.length}</span>}
            </div>
            <div className="exp-toolbar-right">
              <div className="exp-pills">
                <button className={`exp-pill${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                  All
                </button>
                {(Object.keys(CITIES) as CityKey[])
                  .filter(k => expenses.some(e => e.city === k))
                  .map(k => (
                    <button key={k}
                      className={`exp-pill exp-pill-${k}${filter === k ? ` exp-pill-active-${k}` : ''}`}
                      onClick={() => setFilter(k)}>
                      {CITIES[k].emoji} {CITIES[k].short}
                    </button>
                  ))}
              </div>
              {!currentUser.isAdmin && (
                <button className="exp-add-btn" onClick={() => setAddOpen(true)}>
                  + Add Expense
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="exp-loading">
              <div className="exp-spinner" />
              <span>Loading expenses…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="exp-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
              <div className="exp-empty-title">
                {filter !== 'all' ? `No expenses for ${CITIES[filter as CityKey]?.short}` : 'No expenses yet'}
              </div>
              {!currentUser.isAdmin && filter === 'all' && (
                <div className="exp-empty-sub">Add your first expense using the button above.</div>
              )}
            </div>
          ) : currentUser.isAdmin ? (
            // Finance Manager: group by person then date
            <div className="exp-list">
              {USERS.map(u => {
                const userExp = filtered.filter(e => e.added_by === u.name)
                if (!userExp.length) return null
                const uUSD = userExp.filter(e => e.currency === 'USD').reduce((s, e) => s + e.amount, 0)
                const uINR = userExp.filter(e => e.currency === 'INR').reduce((s, e) => s + e.amount, 0)
                const byDate = userExp.reduce<Record<string, Expense[]>>((acc, e) => {
                  (acc[e.expense_date] ??= []).push(e); return acc
                }, {})
                const dKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a))
                return (
                  <div key={u.name} className="exp-person-block">
                    <div className="exp-person-header">
                      <div className="exp-person-avatar" style={{ background: u.color }}>{u.initials}</div>
                      <div>
                        <div className="exp-person-name">{u.name}</div>
                        <div className="exp-person-meta">
                          {userExp.length} receipt{userExp.length !== 1 ? 's' : ''}
                          {uUSD > 0 && ` · $${uUSD.toFixed(2)}`}
                          {uINR > 0 && ` · ₹${uINR.toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                    {dKeys.map(date => (
                      <div key={date}>
                        <div className="exp-date-group">
                          <span className="exp-date-label">{fmtDateGroup(date)}</span>
                          <span className="exp-date-count">{byDate[date].length} item{byDate[date].length !== 1 ? 's' : ''}</span>
                        </div>
                        {byDate[date].map(e => (
                          <ExpenseRow key={e.id} expense={e} readOnly
                            onDelete={deleteExpense} onEdit={startEdit}
                            onLightbox={(urls, idx) => setLightbox({ urls, idx })} />
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ) : (
            // Regular user: group by date
            <div className="exp-list">
              {dateKeys.map(date => (
                <div key={date}>
                  <div className="exp-date-group">
                    <span className="exp-date-label">{fmtDateGroup(date)}</span>
                    <span className="exp-date-count">{expensesByDate[date].length} item{expensesByDate[date].length !== 1 ? 's' : ''}</span>
                  </div>
                  {expensesByDate[date].map(e => (
                    <ExpenseRow key={e.id} expense={e}
                      onDelete={deleteExpense} onEdit={startEdit}
                      onLightbox={(urls, idx) => setLightbox({ urls, idx })} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADD EXPENSE SLIDE-OVER */}
      {addOpen && (
        <div className="exp-slideover">
          <div className="exp-so-backdrop" onClick={() => { if (!saving) setAddOpen(false) }} />
          <div className="exp-so-panel">
            <div className="exp-so-header">
              <h3 className="exp-so-title">Add Expense</h3>
              <button className="exp-so-close" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <div className="exp-so-body">
              <div className="form-group">
                <label className="form-label">Description *</label>
                <input className="form-control" value={form.desc} placeholder="e.g. Team dinner at Nobu"
                  onChange={e => setField('desc', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-control" value={form.category} onChange={e => setField('category', e.target.value)}>
                  <option value="">-- Select Category --</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <div className="amount-row">
                  <div className="currency-input">
                    <span className="currency-symbol">{form.currency === 'USD' ? '$' : '₹'}</span>
                    <input type="number" className="form-control" value={form.amount}
                      placeholder="0.00" step="0.01" min="0"
                      onChange={e => setField('amount', e.target.value)} />
                  </div>
                  <select className="form-control" value={form.currency}
                    onChange={e => { setField('currency', e.target.value as 'USD' | 'INR'); setField('inrEquiv', '') }}>
                    <option value="USD">🇺🇸 USD</option>
                    <option value="INR">🇮🇳 INR</option>
                  </select>
                </div>
                {form.currency === 'USD' && (
                  <div className="inr-card-field">
                    <div className="inr-card-label">₹ INR charged on card <span>(Amex / Niyo — fill after billing)</span></div>
                    <div className="currency-input">
                      <span className="currency-symbol">₹</span>
                      <input type="number" className="form-control" value={form.inrEquiv}
                        placeholder="e.g. 12,450.00" step="0.01" min="0"
                        onChange={e => setField('inrEquiv', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={form.date}
                    onChange={e => setField('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <select className="form-control" value={form.city} onChange={e => setField('city', e.target.value)}>
                    <option value="">-- Select --</option>
                    {(Object.keys(CITIES) as CityKey[]).map(k => (
                      <option key={k} value={k}>{CITIES[k].emoji} {CITIES[k].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control notes-input" value={form.notes}
                  placeholder="Optional notes for finance team..."
                  onChange={e => setField('notes', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Receipt Photos</label>
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                {receiptFiles.length === 0 ? (
                  <div className={`upload-zone${dragging ? ' dragover' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)) }}>
                    <div className="upload-icon">📎</div>
                    <div className="upload-text">
                      <strong>Click to upload</strong> or drag &amp; drop<br />
                      <span>PNG, JPG, HEIC up to 10 MB each</span>
                    </div>
                  </div>
                ) : (
                  <div className="upload-previews">
                    {receiptFiles.map((f, i) => (
                      <div key={i} className="upload-preview-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.preview} alt={`Receipt ${i + 1}`} />
                        <button className="upload-preview-remove" onClick={() => removeFile(i)}>✕</button>
                      </div>
                    ))}
                    <div className="upload-add-more" onClick={() => fileInputRef.current?.click()}>+</div>
                  </div>
                )}
              </div>
            </div>
            <div className="exp-so-footer">
              <button className="btn-cancel" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="exp-so-submit" onClick={addExpense} disabled={saving}>
                {saving ? '⏳ Saving…' : '✓ Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingExpense && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeEdit()}>
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Edit Expense</div>
              <button className="modal-close" onClick={closeEdit}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Description *</label>
                <input className="form-control" value={editForm.desc}
                  onChange={e => setEditForm(f => ({ ...f, desc: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-control" value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">-- Select Category --</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <div className="amount-row">
                  <div className="currency-input">
                    <span className="currency-symbol">{editForm.currency === 'USD' ? '$' : '₹'}</span>
                    <input type="number" className="form-control" value={editForm.amount}
                      placeholder="0.00" step="0.01" min="0"
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <select className="form-control" value={editForm.currency}
                    onChange={e => setEditForm(f => ({ ...f, currency: e.target.value as 'USD' | 'INR', inrEquiv: '' }))}>
                    <option value="USD">🇺🇸 USD</option>
                    <option value="INR">🇮🇳 INR</option>
                  </select>
                </div>
                {editForm.currency === 'USD' && (
                  <div className="inr-card-field">
                    <div className="inr-card-label">₹ INR charged on card <span>(Amex / Niyo — fill after billing)</span></div>
                    <div className="currency-input">
                      <span className="currency-symbol">₹</span>
                      <input type="number" className="form-control" value={editForm.inrEquiv}
                        placeholder="e.g. 12,450.00" step="0.01" min="0"
                        onChange={e => setEditForm(f => ({ ...f, inrEquiv: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={editForm.date}
                    onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <select className="form-control" value={editForm.city}
                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}>
                    <option value="">-- Select --</option>
                    {(Object.keys(CITIES) as CityKey[]).map(k => (
                      <option key={k} value={k}>{CITIES[k].emoji} {CITIES[k].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control notes-input" value={editForm.notes}
                  placeholder="Optional notes for finance team..."
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Receipt Photos
                  {(editExistingUrls.length + editNewFiles.length) > 0 && (
                    <span style={{ fontWeight: 400, marginLeft: 6, color: 'var(--exp-text-muted)' }}>
                      ({editExistingUrls.length + editNewFiles.length} attached)
                    </span>
                  )}
                </label>
                <input ref={editFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { addEditFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                {(editExistingUrls.length > 0 || editNewFiles.length > 0) && (
                  <div className="upload-previews" style={{ marginBottom: 8 }}>
                    {editExistingUrls.map((url, i) => (
                      <div key={`ex-${i}`} className="upload-preview-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Receipt ${i + 1}`} />
                        <button className="upload-preview-remove"
                          onClick={() => setEditExistingUrls(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                      </div>
                    ))}
                    {editNewFiles.map((f, i) => (
                      <div key={`new-${i}`} className="upload-preview-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.preview} alt={`New ${i + 1}`}
                          style={{ outline: '2px solid var(--exp-primary-light)' }} />
                        <button className="upload-preview-remove" onClick={() => removeEditNewFile(i)}>✕</button>
                      </div>
                    ))}
                    <div className="upload-add-more" onClick={() => editFileRef.current?.click()}>+</div>
                  </div>
                )}
                {editExistingUrls.length === 0 && editNewFiles.length === 0 && (
                  <div className="upload-zone" onClick={() => editFileRef.current?.click()}>
                    <div className="upload-icon">📎</div>
                    <div className="upload-text"><strong>Click to upload</strong> receipt photos</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeEdit}>Cancel</button>
              <button className="btn-save" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? '⏳ Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="exp-lightbox" onClick={() => setLightbox(null)}>
          <button className="exp-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox.urls.length > 1 && (
            <button className="lightbox-nav lightbox-prev"
              onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: (l.idx - 1 + l.urls.length) % l.urls.length } : null) }}>
              ‹
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.urls[lightbox.idx]} alt="Receipt" onClick={e => e.stopPropagation()} />
          {lightbox.urls.length > 1 && (
            <button className="lightbox-nav lightbox-next"
              onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: (l.idx + 1) % l.urls.length } : null) }}>
              ›
            </button>
          )}
          {lightbox.urls.length > 1 && (
            <div className="lightbox-counter">{lightbox.idx + 1} / {lightbox.urls.length}</div>
          )}
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`exp-toast${toast.type !== 'success' ? ` exp-toast-${toast.type}` : ''}`}>
          {toast.msg}
        </div>
      )}
    </>
  )
}

// ── EXPENSE ROW ───────────────────────────────────────────────────
function ExpenseRow({
  expense: e,
  onDelete,
  onEdit,
  onLightbox,
  readOnly = false,
}: {
  expense: Expense
  onDelete: (id: string) => void
  onEdit: (expense: Expense) => void
  onLightbox: (urls: string[], idx: number) => void
  readOnly?: boolean
}) {
  const urls = e.receipt_urls ?? []
  const sym  = currSymbol(e.currency)

  return (
    <div className={`exp-row${readOnly ? ' exp-row-readonly' : ''}`}>
      {/* Thumbnail */}
      <div className="exp-row-thumb">
        {urls.length === 0 ? (
          <div className="exp-thumb-empty">🧾</div>
        ) : (
          <div className="exp-thumb-wrap" onClick={() => onLightbox(urls, 0)} title="View receipt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[0]} alt="Receipt" className="exp-thumb-img" />
            {urls.length > 1 && <div className="exp-thumb-more">+{urls.length - 1}</div>}
          </div>
        )}
      </div>

      {/* Description + meta */}
      <div className="exp-row-body">
        <div className="exp-row-desc">{e.description}</div>
        <div className="exp-row-meta">
          <span className={`city-tag ${e.city}`}>
            {CITIES[e.city as CityKey]?.emoji} {CITIES[e.city as CityKey]?.short ?? e.city}
          </span>
          <span className="exp-cat-tag">{e.category}</span>
          {e.added_by && <span className="exp-by-tag">👤 {e.added_by.split(' ')[0]}</span>}
        </div>
        {e.notes && <div className="exp-row-notes">&ldquo;{e.notes}&rdquo;</div>}
      </div>

      {/* Amount */}
      <div className="exp-row-amount">
        <div className="exp-amount-primary">{sym}{e.amount.toFixed(2)}</div>
        {e.currency === 'USD' && e.inr_equivalent
          ? <div className="exp-amount-inr inr-filled">₹{e.inr_equivalent.toFixed(2)}</div>
          : <div className="exp-amount-inr">{e.currency}</div>
        }
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="exp-row-actions">
          <button className="btn-action edit" onClick={() => onEdit(e)} title="Edit">✏️</button>
          <button className="btn-action delete" onClick={() => onDelete(e.id)} title="Delete">✕</button>
        </div>
      )}
    </div>
  )
}
