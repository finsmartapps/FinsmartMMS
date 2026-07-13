'use client'

import { useState } from 'react'
import {
  Plus, Loader2, X, PenLine, Trash2, RotateCcw,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  MoreHorizontal, Link2, Check, BarChart2, LayoutList,
  ExternalLink,
} from 'lucide-react'

type SocialPost = {
  id: string
  description: string
  image_url: string | null
  publish_date: string
  platform: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  created_by: string
  reviewed_by: string | null
  created_at: string
  reviewed_at: string | null
  approval_token: string | null
}

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 ' +
  'focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-400/10 ' +
  'transition bg-white placeholder-slate-400'

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/?]+)/)
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`
  const idMatch = url.match(/[?&]id=([^&]+)/)
  if (idMatch && url.includes('drive.google.com')) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`
  return url
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtPublishDate(iso: string) {
  const d  = new Date(iso + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 60)  return `${m}m`
  const h  = Math.floor(m  / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400'   },
  approved: { label: 'Approved',       badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  rejected: { label: 'Changes Needed', badgeCls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-400'     },
}

const BLANK_FORM = { description: '', image_url: '', publish_date: '', platform: 'LinkedIn' }

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const abbr = initials(name).toUpperCase() || '?'
  return (
    <div style={{ width: size, height: size, minWidth: size }}
      className="rounded-full bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center shadow-sm">
      <span className="text-white font-bold" style={{ fontSize: size * 0.38 }}>{abbr}</span>
    </div>
  )
}

// ── Post text with See more/less ──────────────────────────────────────────────

const CHAR_LIMIT = 300

function PostText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long  = text.length > CHAR_LIMIT
  const shown = long && !expanded ? text.slice(0, CHAR_LIMIT) + '…' : text
  return (
    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
      {shown}
      {long && (
        <button onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-0.5 ml-1 text-slate-500 font-semibold hover:text-pink-600 transition text-[13px]">
          {expanded ? <><ChevronUp size={13} /> see less</> : <><ChevronDown size={13} /> see more</>}
        </button>
      )}
    </div>
  )
}

// ── Image block ───────────────────────────────────────────────────────────────

function PostImage({ url, linkUrl }: { url: string; linkUrl: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer"
      className="block w-full overflow-hidden bg-slate-100">
      <img src={url} alt="" className="w-full" onError={() => setFailed(true)} />
    </a>
  )
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditForm({ postId, initial, isResubmit, onSave, onCancel }: {
  postId: string
  initial: { description: string; image_url: string; publish_date: string; platform: string }
  isResubmit: boolean
  onSave: (updated: SocialPost) => void
  onCancel: () => void
}) {
  const [form,   setForm]   = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setError('')
    if (!form.description.trim()) { setError('Description is required'); return }
    if (!form.publish_date)       { setError('Publish date is required'); return }
    setSaving(true)
    const res = await fetch(`/api/ms-social/posts/${postId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: form.description, image_url: form.image_url || null, publish_date: form.publish_date, platform: form.platform }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
    onSave(data.post)
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 space-y-4 rounded-b-2xl">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
        {isResubmit ? 'Edit & Resubmit' : 'Edit Post'}
      </p>
      <textarea className={`${inputCls} resize-none`} rows={7}
        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Publish Date *</label>
          <input type="date" className={inputCls} value={form.publish_date}
            onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
          <select className={inputCls} value={form.platform}
            onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
            <option>LinkedIn</option><option>Twitter</option><option>Instagram</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Image URL <span className="normal-case font-normal text-slate-400">(Google Drive link or direct image URL)</span>
        </label>
        <input className={inputCls} placeholder="https://drive.google.com/file/d/…"
          value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition shadow-sm">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Submitting…' : isResubmit ? 'Resubmit for Approval' : 'Save Changes'}
        </button>
        <button onClick={onCancel}
          className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-white transition">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post, userName, onDelete, onUpdate }: {
  post: SocialPost; userName: string
  onDelete: (id: string) => void; onUpdate: (updated: SocialPost) => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied,   setCopied]   = useState(false)

  function copyApprovalLink() {
    if (!post.approval_token) return
    const url = `${window.location.origin}/approve/${post.approval_token}`
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const cfg      = STATUS_CONFIG[post.status]
  const embedUrl = toEmbedUrl(post.image_url)
  const canEdit  = post.status === 'pending' || post.status === 'rejected'

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    const res = await fetch(`/api/ms-social/posts/${post.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) onDelete(post.id)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <Avatar name={userName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-[15px] leading-tight">{userName}</span>
            <span className="text-[11px] text-slate-400 border border-slate-300 rounded px-1 leading-4">1st</span>
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5">Finsmart Accounting</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-slate-400">{post.platform} · {timeAgo(post.created_at)}</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-1.5 py-0.5">
              Publishing Date: {fmtPublishDate(post.publish_date)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${cfg.badgeCls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          {canEdit && (
            <div className="relative">
              <button onClick={() => setMenuOpen(o => !o)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[170px]">
                    {post.approval_token && (
                      <button onClick={() => { setMenuOpen(false); copyApprovalLink() }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                        {copied ? <Check size={13} className="text-emerald-500" /> : <Link2 size={13} />}
                        {copied ? 'Link copied!' : 'Copy Approval Link'}
                      </button>
                    )}
                    <button onClick={() => { setMenuOpen(false); setEditing(true) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                      <PenLine size={13} />
                      {post.status === 'rejected' ? 'Edit & Resubmit' : 'Edit'}
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleDelete() }} disabled={deleting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-5 pb-3">
        <PostText text={post.description} />
      </div>
      {post.status === 'rejected' && post.reviewer_notes && !editing && (
        <div className="mx-5 mb-3 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-red-600 mb-0.5">Reviewer Feedback</p>
            <p className="text-sm text-red-700 leading-relaxed">{post.reviewer_notes}</p>
          </div>
        </div>
      )}
      {post.status === 'approved' && post.reviewer_notes && (
        <div className="mx-5 mb-3 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">Reviewer Note</p>
            <p className="text-sm text-emerald-800 leading-relaxed">{post.reviewer_notes}</p>
          </div>
        </div>
      )}
      {embedUrl && !editing && <PostImage url={embedUrl} linkUrl={post.image_url!} />}
      {post.status === 'rejected' && !editing && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3">
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 transition shadow-sm">
            <RotateCcw size={13} /> Edit &amp; Resubmit
          </button>
        </div>
      )}
      {editing && (
        <EditForm
          postId={post.id}
          initial={{ description: post.description, image_url: post.image_url ?? '', publish_date: post.publish_date, platform: post.platform }}
          isResubmit={post.status === 'rejected'}
          onSave={updated => { onUpdate(updated); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

type DayGroup = {
  date: string
  posts: SocialPost[]
  approved: SocialPost[]
  pending: SocialPost[]
  rejected: SocialPost[]
  publishDates: string[]
}

function groupByDay(posts: SocialPost[]): DayGroup[] {
  const map = new Map<string, SocialPost[]>()
  for (const p of posts) {
    const day = p.created_at.split('T')[0]
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(p)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, ps]) => ({
      date,
      posts: ps,
      approved:     ps.filter(p => p.status === 'approved'),
      pending:      ps.filter(p => p.status === 'pending'),
      rejected:     ps.filter(p => p.status === 'rejected'),
      publishDates: [...new Set(ps.map(p => p.publish_date))].sort(),
    }))
}

// ── Posts popup modal ─────────────────────────────────────────────────────────

function PostsModal({ title, posts, onClose }: {
  title: string; posts: SocialPost[]; onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="text-[12px] text-slate-400 mt-0.5">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <X size={16} />
            </button>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {posts.map(post => {
              const cfg = STATUS_CONFIG[post.status]
              const embedUrl = toEmbedUrl(post.image_url)
              return (
                <div key={post.id} className="px-5 py-4 space-y-2.5">
                  {/* Status + dates */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${cfg.badgeCls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Submitted: {fmtDate(post.created_at.split('T')[0])}</span>
                      <span className="text-blue-600 font-semibold">Publish: {fmtPublishDate(post.publish_date)}</span>
                    </div>
                  </div>
                  {/* Text preview */}
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{post.description}</p>
                  {/* Thumbnail */}
                  {embedUrl && (
                    <a href={post.image_url!} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-pink-600 transition">
                      <ExternalLink size={11} /> View image
                    </a>
                  )}
                  {/* Reviewer notes */}
                  {post.reviewer_notes && (
                    <div className={`text-[12px] rounded-lg px-3 py-2 ${
                      post.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <span className="font-semibold">Note: </span>{post.reviewer_notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Stats table ───────────────────────────────────────────────────────────────

function StatsTable({ posts }: { posts: SocialPost[] }) {
  const [modal, setModal] = useState<{ title: string; posts: SocialPost[] } | null>(null)
  const groups = groupByDay(posts)

  const totalApproved = posts.filter(p => p.status === 'approved').length
  const totalPending  = posts.filter(p => p.status === 'pending').length
  const totalRejected = posts.filter(p => p.status === 'rejected').length

  function open(title: string, filtered: SocialPost[]) {
    if (filtered.length > 0) setModal({ title, posts: filtered })
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
        <BarChart2 size={28} className="text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-500">No data yet</p>
        <p className="text-sm text-slate-400 mt-1">Submit your first post to see stats here</p>
      </div>
    )
  }

  const CountCell = ({
    count, color, title, filtered,
  }: { count: number; color: string; title: string; filtered: SocialPost[] }) => (
    <td className="px-4 py-3.5 text-center">
      {count > 0 ? (
        <button onClick={() => open(title, filtered)}
          className={`font-bold text-[15px] hover:underline transition ${color}`}>
          {count}
        </button>
      ) : (
        <span className="text-slate-200 text-sm select-none">—</span>
      )}
    </td>
  )

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[580px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Sr.', 'Submitted Date', 'Publishing Date', '', '', ''].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider ${
                    i < 3 ? 'text-left text-slate-500' : [
                      'text-center text-emerald-600',
                      'text-center text-amber-600',
                      'text-center text-red-600',
                    ][i - 3]
                  }`}>
                    {h || ['Approved', 'Pending', 'Rejected'][i - 3]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g, i) => (
                <tr key={g.date} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3.5 text-slate-400 text-[13px] w-10">{i + 1}</td>
                  <td className="px-4 py-3.5 text-slate-700 text-[13px] font-medium whitespace-nowrap">
                    {fmtDate(g.date)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 text-[13px]">
                    {g.publishDates.length === 1
                      ? fmtPublishDate(g.publishDates[0])
                      : g.publishDates.map(d => fmtPublishDate(d)).join(', ')}
                  </td>
                  <CountCell count={g.approved.length} color="text-emerald-600"
                    title={`Approved — ${fmtDate(g.date)}`} filtered={g.approved} />
                  <CountCell count={g.pending.length} color="text-amber-600"
                    title={`Pending — ${fmtDate(g.date)}`} filtered={g.pending} />
                  <CountCell count={g.rejected.length} color="text-red-600"
                    title={`Rejected — ${fmtDate(g.date)}`} filtered={g.rejected} />
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-[12px] font-bold text-slate-600">Total</td>
                <CountCell count={totalApproved} color="text-emerald-700"
                  title="All Approved" filtered={posts.filter(p => p.status === 'approved')} />
                <CountCell count={totalPending} color="text-amber-700"
                  title="All Pending" filtered={posts.filter(p => p.status === 'pending')} />
                <CountCell count={totalRejected} color="text-red-700"
                  title="All Rejected" filtered={posts.filter(p => p.status === 'rejected')} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {modal && <PostsModal title={modal.title} posts={modal.posts} onClose={() => setModal(null)} />}
    </>
  )
}

// ── Main feed ─────────────────────────────────────────────────────────────────

export function MsSocialFeedClient({
  initialPosts,
  userId,
  userName,
}: {
  initialPosts: SocialPost[]
  userId: string
  userName: string
}) {
  void userId
  const [posts,     setPosts]     = useState(initialPosts)
  const [showNew,   setShowNew]   = useState(false)
  const [form,      setForm]      = useState(BLANK_FORM)
  const [creating,  setCreating]  = useState(false)
  const [formError, setFormError] = useState('')
  const [viewMode,  setViewMode]  = useState<'feed' | 'stats'>('feed')

  async function handleCreate() {
    setFormError('')
    if (!form.description.trim()) { setFormError('Description is required'); return }
    if (!form.publish_date)       { setFormError('Publish date is required'); return }
    setCreating(true)
    const res = await fetch('/api/ms-social/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: form.description, image_url: form.image_url || null, publish_date: form.publish_date, platform: form.platform }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create post'); return }
    setPosts(prev => [data.post, ...prev])
    setShowNew(false)
    setForm(BLANK_FORM)
  }

  const counts = {
    pending:  posts.filter(p => p.status === 'pending').length,
    approved: posts.filter(p => p.status === 'approved').length,
    rejected: posts.filter(p => p.status === 'rejected').length,
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MS Social</h1>
            <p className="text-slate-500 text-sm mt-0.5">Hi {userName} — submit LinkedIn posts for manager approval</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Stats summary chips */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-sm">
              <span className="font-bold text-amber-600">{counts.pending}</span>
              <span className="text-slate-400 text-[11px]">Pending</span>
              <span className="w-px h-3 bg-slate-200 mx-1" />
              <span className="font-bold text-emerald-600">{counts.approved}</span>
              <span className="text-slate-400 text-[11px]">Approved</span>
              {counts.rejected > 0 && (
                <>
                  <span className="w-px h-3 bg-slate-200 mx-1" />
                  <span className="font-bold text-red-600">{counts.rejected}</span>
                  <span className="text-slate-400 text-[11px]">Rejected</span>
                </>
              )}
            </div>
            {/* View toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button onClick={() => setViewMode('feed')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition ${
                  viewMode === 'feed' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                <LayoutList size={14} /> Feed
              </button>
              <button onClick={() => setViewMode('stats')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition ${
                  viewMode === 'stats' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                <BarChart2 size={14} /> Stats
              </button>
            </div>
            {/* New Post */}
            <button
              onClick={() => { setShowNew(true); setFormError(''); setForm(BLANK_FORM) }}
              className="flex items-center gap-1.5 bg-pink-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-pink-700 transition shadow-sm">
              <Plus size={15} /> New Post
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {viewMode === 'stats' ? (
          <StatsTable posts={posts} />
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
            <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PenLine size={24} className="text-pink-400" />
            </div>
            <p className="font-semibold text-slate-600 text-lg">No posts yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">Submit your first LinkedIn post for review</p>
            <button onClick={() => { setShowNew(true); setFormError(''); setForm(BLANK_FORM) }}
              className="inline-flex items-center gap-1.5 bg-pink-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-pink-700 transition">
              <Plus size={15} /> New Post
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} userName={userName}
                onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))}
                onUpdate={updated => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── New Post modal ── */}
      {showNew && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Avatar name={userName} size={40} />
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">{userName}</p>
                    <p className="text-[12px] text-slate-400">Submit a LinkedIn post for approval</p>
                  </div>
                </div>
                <button onClick={() => setShowNew(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Post Content *</label>
                  <textarea className={`${inputCls} resize-none`} rows={7}
                    placeholder="Write your LinkedIn post content here…"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Publish Date *</label>
                    <input type="date" className={inputCls} value={form.publish_date}
                      onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
                    <select className={inputCls} value={form.platform}
                      onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                      <option>LinkedIn</option><option>Twitter</option><option>Instagram</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Image URL <span className="normal-case font-normal text-slate-400">(Google Drive link or any image URL)</span>
                  </label>
                  <input className={inputCls} placeholder="https://drive.google.com/file/d/…"
                    value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
                </div>
                {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{formError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button onClick={() => setShowNew(false)}
                  className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex items-center gap-1.5 text-sm font-semibold px-6 py-2.5 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition">
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  {creating ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
