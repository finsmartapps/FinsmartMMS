'use client'

import { useState } from 'react'
import { BarChart2, X, ExternalLink } from 'lucide-react'

type SocialPost = {
  id: string
  description: string
  image_url: string | null
  publish_date: string
  platform: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  created_at: string
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400'   },
  approved: { label: 'Approved',       badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  rejected: { label: 'Changes Needed', badgeCls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-400'     },
}

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

function PostsModal({ title, posts, onClose }: {
  title: string; posts: SocialPost[]; onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[80vh]">
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
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {posts.map(post => {
              const cfg = STATUS_CONFIG[post.status]
              const embedUrl = toEmbedUrl(post.image_url)
              return (
                <div key={post.id} className="px-5 py-4 space-y-2.5">
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
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{post.description}</p>
                  {embedUrl && (
                    <a href={post.image_url!} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-pink-600 transition">
                      <ExternalLink size={11} /> View image
                    </a>
                  )}
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

export function MsSocialStatsClient({ posts, userName }: {
  posts: SocialPost[]
  userName: string
}) {
  const [modal, setModal] = useState<{ title: string; posts: SocialPost[] } | null>(null)
  const groups = groupByDay(posts)

  const totalApproved = posts.filter(p => p.status === 'approved').length
  const totalPending  = posts.filter(p => p.status === 'pending').length
  const totalRejected = posts.filter(p => p.status === 'rejected').length

  function open(title: string, filtered: SocialPost[]) {
    if (filtered.length > 0) setModal({ title, posts: filtered })
  }

  const CountCell = ({ count, color, title, filtered }: {
    count: number; color: string; title: string; filtered: SocialPost[]
  }) => (
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Stats</h1>
        <p className="text-slate-500 text-sm mt-0.5">Hi {userName} — your post submission history</p>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-bold text-amber-600">{totalPending}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Pending</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold text-emerald-600">{totalApproved}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Approved</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="font-bold text-red-600">{totalRejected}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Rejected</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="font-bold text-slate-700">{posts.length}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Total Posts</span>
        </div>
      </div>

      {/* Table */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
          <BarChart2 size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">No data yet</p>
          <p className="text-sm text-slate-400 mt-1">Submit your first post to see stats here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[580px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Sr.</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Submitted Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Publishing Date</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-emerald-600">Approved</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-red-600">Rejected</th>
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
                      {g.publishDates.map(d => fmtPublishDate(d)).join(', ')}
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
      )}

      {modal && <PostsModal title={modal.title} posts={modal.posts} onClose={() => setModal(null)} />}
    </div>
  )
}
