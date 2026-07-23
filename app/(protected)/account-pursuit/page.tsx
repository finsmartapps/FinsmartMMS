import { Target, Building2, Users, MessageSquare, CalendarClock } from 'lucide-react'

export default function AccountPursuitHome() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
          <Target size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#1D1D1F] leading-tight">Account Pursuit</h1>
          <p className="text-[13px] text-[#6E6E73]">Account-based LinkedIn outreach for big aggregator targets</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/60 px-5 py-4">
        <p className="text-[13px] font-semibold text-teal-800">Foundation ready ✅</p>
        <p className="text-[13px] text-teal-700 mt-1">
          The data model and access are live. The working screens below are being built next (Phase 1).
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { icon: CalendarClock, title: 'Follow-ups Due', desc: 'Your daily "who to touch today" list — the home screen.' },
          { icon: Building2,     title: 'Target Accounts', desc: 'Aggregator firms, tiered A/B/C, with pursuit status.' },
          { icon: Users,         title: 'Committee Contacts', desc: 'Decision-makers per account with connection state.' },
          { icon: MessageSquare, title: 'Message Thread + AI', desc: 'Full history, next step, and AI-drafted follow-ups.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-[#E5E5EA] bg-white px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} className="text-teal-600" />
              <p className="text-[13px] font-semibold text-[#1D1D1F]">{title}</p>
            </div>
            <p className="text-[12px] text-[#6E6E73] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
