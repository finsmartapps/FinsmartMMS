'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import type { Expense } from '@/lib/expenses/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── HELPERS ───────────────────────────────────────────────────────
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
    'City':             (CITIES as Record<string,{label:string}>)[e.city]?.label ?? e.city,
    'Added By':         e.added_by || '',
    'Description':      e.description,
    'Category':         e.category.replace(/^\p{Emoji}\s*/u, ''),
    'Amount':           e.amount,
    'Currency':         e.currency,
    'INR on Card (₹)': e.currency === 'USD' ? (e.inr_equivalent ?? '') : e.amount,
    'Notes':            e.notes || '',
    'Receipts':         e.receipt_urls?.length ? `${e.receipt_urls.length} photo(s)` : 'No',
  }))

  const usdExp   = expenses.filter(e => e.currency === 'USD')
  const inrExp   = expenses.filter(e => e.currency === 'INR')
  const totalINRReimburse =
    inrExp.reduce((s, e) => s + e.amount, 0) +
    usdExp.filter(e => e.inr_equivalent).reduce((s, e) => s + (e.inr_equivalent ?? 0), 0)

  const summaryRows = [
    { Label: 'Total USD Expenses',       Value: `$${usdExp.reduce((s,e) => s+e.amount, 0).toFixed(2)}`, Count: usdExp.length },
    { Label: 'Total INR Expenses',       Value: `₹${inrExp.reduce((s,e) => s+e.amount, 0).toFixed(2)}`, Count: inrExp.length },
    { Label: 'Total INR to Reimburse',   Value: `₹${totalINRReimburse.toFixed(2)}`, Count: '' },
    { Label: 'USD receipts pending INR', Value: '', Count: usdExp.filter(e => !e.inr_equivalent).length },
    { Label: 'Total receipts',           Value: '', Count: expenses.length },
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
  setDownloading: (v: boolean) => void
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

    const blob  = await zip.generateAsync({ type: 'blob' })
    const link  = Object.assign(document.createElement('a'), {
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

// ── AUTH ──────────────────────────────────────────────────────────
const AUTH_KEY = 'travel_exp_user_v1'

const USERS = [
  { name: 'Chirag Patel',    initials: 'CP', color: '#2454a0', code: '9979791234', isAdmin: false },
  { name: 'Piyush Devnani',  initials: 'PD', color: '#7b2d8b', code: '7744099934', isAdmin: false },
  { name: 'Sharvari Gandhi', initials: 'SG', color: '#1a7a4a', code: '8275805531', isAdmin: false },
  { name: 'Finance Manager', initials: 'FM', color: '#c0392b', code: '0000000000', isAdmin: true  },
]
type AppUser = typeof USERS[0]

function LoginScreen({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [selected, setSelected] = useState<AppUser | null>(null)
  const [code, setCode]         = useState('')
  const [showCode, setShowCode] = useState(false)
  const [error, setError]       = useState(false)
  const [shake, setShake]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (selected) inputRef.current?.focus() }, [selected])

  function attempt() {
    if (!selected) return
    if (code === selected.code) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ name: selected.name, initials: selected.initials, color: selected.color, isAdmin: selected.isAdmin }))
      onLogin(selected)
    } else {
      setError(true); setShake(true)
      setTimeout(() => setShake(false), 400)
      setCode(''); inputRef.current?.focus()
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">✈️</div>
        <div className="login-title">Travel Expense Manager</div>
        <div className="login-subtitle">US Business Trip — June 2026</div>
        <div className="login-trips">
          <span className="login-trip-badge lv">🎰 Las Vegas</span>
          <span className="login-trip-badge or">🎡 Orlando</span>
        </div>

        {!selected ? (
          <>
            <label className="login-label" style={{ marginBottom: 12 }}>Who are you?</label>
            <div className="user-select-grid">
              {USERS.filter(u => !u.isAdmin).map(u => (
                <button key={u.name} className="user-select-btn" onClick={() => setSelected(u)}>
                  <div className="user-avatar" style={{ background: u.color }}>{u.initials}</div>
                  <div className="user-select-name">{u.name.split(' ')[0]}</div>
                </button>
              ))}
            </div>
            <div className="login-divider">or</div>
            <button className="user-select-btn finance-btn" onClick={() => setSelected(USERS.find(u => u.isAdmin)!)}>
              <div className="user-avatar" style={{ background: '#c0392b' }}>💼</div>
              <div className="user-select-name">Finance Manager</div>
            </button>
          </>
        ) : (
          <>
            <div className="login-who">
              <div className="user-avatar sm" style={{ background: selected.color }}>{selected.initials}</div>
              <span>{selected.name}</span>
              <button className="login-change" onClick={() => { setSelected(null); setCode(''); setError(false) }}>Change</button>
            </div>
            <label className="login-label">Access Code</label>
            <div className="login-input-wrap">
              <input ref={inputRef}
                className={`login-input${shake ? ' error' : ''}`}
                type={showCode ? 'text' : 'password'}
                inputMode="numeric" maxLength={10} value={code}
                placeholder="••••••••••" autoComplete="off"
                onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(false) }}
                onKeyDown={e => e.key === 'Enter' && attempt()} />
              <button className="login-toggle" tabIndex={-1}
                onClick={() => setShowCode(s => !s)}>{showCode ? '🙈' : '👁️'}</button>
            </div>
            {error && <div className="login-error">❌ Incorrect code. Please try again.</div>}
            <button className="login-btn" onClick={attempt} disabled={!code.length}>🔓 Enter</button>
          </>
        )}

        <div className="login-footer">Authorised personnel only</div>
      </div>
    </div>
  )
}

// ── CONSTANTS ─────────────────────────────────────────────────────
const CATEGORIES = [
  '🍽️ Meals & Dining', '🏨 Hotel / Accommodation', '✈️ Flights',
  '🚗 Transport / Taxi / Uber', '📋 Conference / Registration',
  '🎁 Client Entertainment', '📦 Office Supplies', '📱 Communication',
  '💊 Medical / Health', '🛍️ Other',
]
const CITIES = {
  lv: { label: 'Las Vegas, NV',  short: 'Las Vegas',   emoji: '🎰', color: '#7b2d8b' },
  or: { label: 'Orlando, FL',    short: 'Orlando',      emoji: '🎡', color: '#1a7a4a' },
  tx: { label: 'Texas, TX',      short: 'Texas',        emoji: '🤠', color: '#c0560a' },
  nj: { label: 'New Jersey, NJ', short: 'New Jersey',   emoji: '🗽', color: '#2471a3' },
} as const
type CityKey = keyof typeof CITIES
type Filter = 'all' | CityKey
interface FormState {
  desc: string; category: string; amount: string; currency: 'USD' | 'INR'
  date: string; city: string; notes: string; inrEquiv: string
}
const today = () => new Date().toISOString().split('T')[0]
const BLANK: FormState = { desc: '', category: '', amount: '', currency: 'USD', date: today(), city: '', notes: '', inrEquiv: '' }

// ── ROOT ──────────────────────────────────────────────────────────
// Auth is handled by the unified app shell — accept user info as props
export default function ExpenseManager({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const appUser: AppUser = {
    name: userName,
    initials: userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    color: '#2454a0',
    code: '',
    isAdmin,
  }
  return (
    <ExpenseManagerInner
      currentUser={appUser}
      onLogout={() => {/* logout handled by unified sidebar */}}
    />
  )
}

// ── INNER APP ─────────────────────────────────────────────────────
function ExpenseManagerInner({ currentUser, onLogout }: { currentUser: AppUser; onLogout: () => void }) {
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<Filter>('all')
  const [form, setForm]               = useState<FormState>(BLANK)
  const [receiptFiles, setReceiptFiles] = useState<FileEntry[]>([])
  const [saving, setSaving]           = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [lightbox, setLightbox]       = useState<{ urls: string[]; idx: number } | null>(null)
  const [dragging, setDragging]       = useState(false)
  const [toast, setToast]             = useState<{ msg: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editForm, setEditForm]             = useState<FormState>({ ...BLANK })
  const [editExistingUrls, setEditExistingUrls] = useState<string[]>([])
  const [editNewFiles, setEditNewFiles]     = useState<FileEntry[]>([])
  const [editSaving, setEditSaving]         = useState(false)
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

  // ── File helpers ──
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

  // ── Form field setter ──
  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ── Add expense ──
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
      .insert({ description: desc.trim(), category, amount: parseFloat(amount), currency, expense_date: date, city, notes: notes.trim(), receipt_urls, inr_equivalent: (currency === 'USD' && form.inrEquiv) ? parseFloat(form.inrEquiv) : null, added_by: currentUser.name, status: 'pending' })
      .select().single()

    if (error) {
      showToast('Failed to save: ' + error.message, 'error')
    } else {
      receiptFiles.forEach(f => URL.revokeObjectURL(f.preview))
      setExpenses(prev => sortByDate([data as Expense, ...prev]))
      setForm({ ...BLANK, date: today() })
      setReceiptFiles([])
      showToast('Expense added ✓')
    }
    setSaving(false)
  }

  // ── Delete expense ──
  async function deleteExpense(id: string) {
    if (!confirm('Remove this expense?')) return
    const { error } = await supabase.from('travel_expenses').delete().eq('id', id)
    if (!error) { setExpenses(prev => prev.filter(e => e.id !== id)); showToast('Expense removed') }
  }

  // ── Edit modal ──
  function startEdit(expense: Expense) {
    setEditingExpense(expense)
    setEditForm({ desc: expense.description, category: expense.category, amount: expense.amount.toString(), currency: expense.currency, date: expense.expense_date, city: expense.city, notes: expense.notes || '', inrEquiv: expense.inr_equivalent ? expense.inr_equivalent.toString() : '' })
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
    const newUrls     = editNewFiles.length > 0 ? await uploadFiles(editNewFiles.map(f => f.file)) : []
    const receipt_urls = [...editExistingUrls, ...newUrls]

    const { data, error } = await supabase
      .from('travel_expenses')
      .update({ description: desc.trim(), category, amount: parseFloat(amount), currency, expense_date: date, city, notes: notes.trim(), receipt_urls, inr_equivalent: (editForm.currency === 'USD' && editForm.inrEquiv) ? parseFloat(editForm.inrEquiv) : null })
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
  const cityGroups  = (Object.keys(CITIES) as CityKey[]).map(k => ({
    key: k, items: filtered.filter(e => e.city === k),
  }))

  return (
    <>
      {/* PAGE TITLE BAR */}
      <div className="exp-page-header">
        <div className="exp-page-title">
          <span className="exp-page-icon">✈️</span>
          <div>
            <h2 className="exp-page-heading">Travel Expenses</h2>
            <span className="exp-page-sub">US Business Trip — June 2026</span>
          </div>
        </div>
        <div className="exp-page-actions">
          <button className="exp-action-btn"
            onClick={() => downloadAllReceipts(expenses, showToast, setDownloading)}
            disabled={downloading || totalPhotos === 0}
            title="Download all receipts as ZIP">
            {downloading ? '⏳ Bundling…' : `📎 Receipts ZIP (${totalPhotos})`}
          </button>
          <button className="exp-action-btn" onClick={() => exportXLS(expenses)} disabled={!expenses.length}>
            📊 Export XLS
          </button>
          <button className="exp-action-btn" onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>

      {/* PRINT HEADER */}
      <div className="print-header">
        <h2 style={{ fontSize: 22, color: '#1a3c6e' }}>Business Trip Expense Report — US 2026</h2>
        <p style={{ color: '#6b7897', marginTop: 4 }}>Las Vegas &amp; Orlando | Prepared for Finance Reimbursement</p>
      </div>

      <div className="container">
        {/* SUMMARY CARDS */}
        <div className="summary-grid">
          <div className="summary-card total-usd">
            <div className="sc-label">Total (USD)</div>
            <div className="sc-value">${fmtAmt(totalUSD)}</div>
            <div className="sc-sub">{usdExp.length} USD expense{usdExp.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="summary-card total-inr">
            <div className="sc-label">Total (INR)</div>
            <div className="sc-value">₹{fmtAmt(totalINR)}</div>
            <div className="sc-sub">{inrExp.length} INR expense{inrExp.length !== 1 ? 's' : ''}</div>
          </div>
          {(Object.keys(CITIES) as CityKey[]).map(k => {
            const cnt = expenses.filter(e => e.city === k).length
            return (
              <div key={k} className={`summary-card ${k}-card`}>
                <div className="sc-label">{CITIES[k].short}</div>
                <div className="sc-value">{cnt}</div>
                <div className="sc-sub">receipt{cnt !== 1 ? 's' : ''}</div>
              </div>
            )
          })}
          <div className="summary-card count">
            <div className="sc-label">Total Receipts</div>
            <div className="sc-value">{expenses.length}</div>
            <div className="sc-sub">{usdExp.length} USD · {inrExp.length} INR</div>
          </div>
          <div className="summary-card reimburse-card">
            <div className="sc-label">Total INR to Reimburse</div>
            <div className="sc-value" style={{ fontSize: 20 }}>
              ₹{(
                inrExp.reduce((s, e) => s + e.amount, 0) +
                usdExp.filter(e => e.inr_equivalent).reduce((s, e) => s + (e.inr_equivalent ?? 0), 0)
              ).toFixed(2)}
            </div>
            <div className="sc-sub">
              {usdExp.filter(e => !e.inr_equivalent).length > 0
                ? `${usdExp.filter(e => !e.inr_equivalent).length} USD receipt${usdExp.filter(e => !e.inr_equivalent).length !== 1 ? 's' : ''} pending card rate`
                : 'All card rates filled ✓'}
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className={currentUser.isAdmin ? 'main-grid admin-view' : 'main-grid'}>

          {/* ── ADD FORM (hidden for Finance Manager) ── */}
          {!currentUser.isAdmin && <div className="form-col">
            <div className="card">
              <div className="card-header"><div className="card-title">➕ Add New Expense</div></div>
              <div className="card-body">

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

                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={form.date}
                    onChange={e => setField('date', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">City *</label>
                  <select className="form-control" value={form.city} onChange={e => setField('city', e.target.value)}>
                    <option value="">-- Select City --</option>
                    {(Object.keys(CITIES) as CityKey[]).map(k => (
                      <option key={k} value={k}>{CITIES[k].emoji} {CITIES[k].label}</option>
                    ))}
                  </select>
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
                        <span>Multiple photos supported · PNG, JPG, HEIC up to 10 MB each</span>
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
                      <div className="upload-add-more" title="Add more photos"
                        onClick={() => fileInputRef.current?.click()}>+</div>
                    </div>
                  )}
                </div>

                <button className="btn-submit" onClick={addExpense} disabled={saving}>
                  {saving ? '⏳ Saving...' : '✅ Add Expense'}
                </button>
              </div>
            </div>
          </div>}

          {/* ── EXPENSE LIST ── */}
          <div className="list-col">
            <div className="card">
              <div className="card-header">
                <div className="card-title">🧾 Expense Receipts</div>
                <div className="filter-bar">
                  <button className={`filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
                  {(Object.keys(CITIES) as CityKey[]).map(k => (
                    <button key={k} className={`filter-btn ${k}${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>
                      {CITIES[k].short}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? <div className="loading-spinner" /> : filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🗂️</div>
                  <div className="empty-text">
                    {currentUser.isAdmin ? 'No expenses submitted yet.' : 'No expenses yet.\nAdd your first receipt using the form.'}
                  </div>
                </div>
              ) : currentUser.isAdmin ? (
                // ── Finance Manager: group by person ──
                <div className="expense-list">
                  {USERS.filter(u => !u.isAdmin).map(u => {
                    const userExp = filtered.filter(e => e.added_by === u.name)
                    if (!userExp.length) return null
                    const userTotal = userExp.reduce((s, e) => ({ ...s, [e.currency]: (s[e.currency as 'USD'|'INR'] ?? 0) + e.amount }), {} as Record<string, number>)
                    const totals = Object.entries(userTotal).map(([c, v]) => `${c === 'USD' ? '$' : '₹'}${v.toFixed(2)}`).join(' · ')
                    return (
                      <div key={u.name}>
                        <div className="section-divider admin-person-divider">
                          <div className="user-avatar sm" style={{ background: u.color }}>{u.initials}</div>
                          {u.name} <span style={{ fontWeight: 400, marginLeft: 8 }}>({userExp.length} receipt{userExp.length !== 1 ? 's' : ''} · {totals})</span>
                        </div>
                        {userExp.map(e => <ExpenseItem key={e.id} expense={e}
                          onDelete={deleteExpense} onEdit={startEdit} readOnly
                          onLightbox={(urls, idx) => setLightbox({ urls, idx })} />)}
                      </div>
                    )
                  })}
                </div>
              ) : (
                // ── Regular user: group by city ──
                <div className="expense-list">
                  {filter === 'all'
                    ? cityGroups.filter(g => g.items.length > 0).map(g => (
                        <div key={g.key}>
                          <div className="section-divider">
                            {CITIES[g.key].emoji} {CITIES[g.key].short} ({g.items.length})
                          </div>
                          {g.items.map(e => <ExpenseItem key={e.id} expense={e}
                            onDelete={deleteExpense} onEdit={startEdit}
                            onLightbox={(urls, idx) => setLightbox({ urls, idx })} />)}
                        </div>
                      ))
                    : filtered.map(e => <ExpenseItem key={e.id} expense={e}
                        onDelete={deleteExpense} onEdit={startEdit}
                        onLightbox={(urls, idx) => setLightbox({ urls, idx })} />)
                  }
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
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
        <div className="toast-wrap">
          <div className={`toast ${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingExpense && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeEdit()}>
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">✏️ Edit Expense</div>
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

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-control" value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">City *</label>
                <select className="form-control" value={editForm.city}
                  onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}>
                  <option value="">-- Select City --</option>
                  <option value="lv">🎰 Las Vegas, NV</option>
                  <option value="or">🎡 Orlando, FL</option>
                </select>
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
                  {(editExistingUrls.length + editNewFiles.length) > 0 &&
                    <span style={{ fontWeight: 400, marginLeft: 6, color: 'var(--text-muted)' }}>
                      ({editExistingUrls.length + editNewFiles.length} attached)
                    </span>
                  }
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
                        <img src={f.preview} alt={`New ${i + 1}`} style={{ outline: '2px solid var(--primary-light)' }} />
                        <button className="upload-preview-remove" onClick={() => removeEditNewFile(i)}>✕</button>
                      </div>
                    ))}
                    <div className="upload-add-more" title="Add more photos"
                      onClick={() => editFileRef.current?.click()}>+</div>
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
                {editSaving ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── EXPENSE ITEM ──────────────────────────────────────────────────
const MAX_THUMBS = 3

function ExpenseItem({
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
  const urls      = e.receipt_urls ?? []
  const visible   = urls.slice(0, MAX_THUMBS)
  const remaining = urls.length - MAX_THUMBS
  const sym       = currSymbol(e.currency)

  return (
    <div className="expense-item">
      {/* Receipt thumbnails */}
      {urls.length === 0 ? (
        <div className="receipt-placeholder" title="No receipt">🧾</div>
      ) : (
        <div className="receipt-thumbs">
          {visible.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} className="receipt-thumb" src={url} alt={`Receipt ${i + 1}`}
              onClick={() => onLightbox(urls, i)} title="Click to enlarge" />
          ))}
          {remaining > 0 && (
            <div className="receipt-more" onClick={() => onLightbox(urls, MAX_THUMBS)}
              title={`${remaining} more photo${remaining !== 1 ? 's' : ''}`}>
              +{remaining}
            </div>
          )}
        </div>
      )}

      <div className="expense-info">
        <div className="expense-desc" title={e.description}>{e.description}</div>
        <div className="expense-meta">
          <span className="expense-date">📅 {fmtDate(e.expense_date)}</span>
          <span className="expense-cat">{e.category}</span>
          <span className={`city-tag ${e.city}`}>{CITIES[e.city as CityKey]?.short ?? e.city}</span>
          {urls.length > 0 && <span className="expense-cat">📎 {urls.length}</span>}
          {e.added_by && <span className="expense-by">👤 {e.added_by.split(' ')[0]}</span>}
        </div>
        {e.notes && <div className="expense-notes">&ldquo;{e.notes}&rdquo;</div>}
      </div>

      <div className="expense-amounts">
        <div className="amount-usd">{sym}{e.amount.toFixed(2)}</div>
        {e.currency === 'USD' && e.inr_equivalent
          ? <div className="amount-inr inr-on-card">₹{e.inr_equivalent.toFixed(2)}</div>
          : <div className="amount-inr">{e.currency}</div>
        }
      </div>

      {!readOnly && (
        <div className="item-actions">
          <button className="btn-action edit" onClick={() => onEdit(e)} title="Edit">✏️</button>
          <button className="btn-action delete" onClick={() => onDelete(e.id)} title="Delete">✕</button>
        </div>
      )}
    </div>
  )
}
