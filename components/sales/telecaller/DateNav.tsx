'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface Props {
  activeDate: string  // YYYY-MM-DD
  todayDate: string   // YYYY-MM-DD (IST today — never navigate past this)
}

export function DateNav({ activeDate, todayDate }: Props) {
  const router = useRouter()

  function go(date: string) {
    if (date === todayDate) {
      router.push('/sales/telecaller')
    } else {
      router.push(`/sales/telecaller?date=${date}`)
    }
  }

  function prevDay() {
    const d = new Date(activeDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    go(d.toISOString().split('T')[0])
  }

  function nextDay() {
    if (activeDate >= todayDate) return
    const d = new Date(activeDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    go(d.toISOString().split('T')[0])
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val && val <= todayDate) go(val)
  }

  const isToday = activeDate === todayDate

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={prevDay}
        title="Previous day"
        className="p-1.5 rounded-lg hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] transition"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Date picker trigger */}
      <div className="relative">
        <input
          type="date"
          value={activeDate}
          max={todayDate}
          onChange={handleDateChange}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#F5F5F7] transition cursor-pointer select-none text-[12px] font-medium text-[#6E6E73]">
          <CalendarDays size={12} />
          {isToday ? 'Today' : activeDate}
        </div>
      </div>

      <button
        onClick={nextDay}
        disabled={isToday}
        title="Next day"
        className="p-1.5 rounded-lg hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
