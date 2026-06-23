'use client'

import './expenses.css'
import dynamic from 'next/dynamic'

const ExpenseManager = dynamic(
  () => import('@/components/expenses/ExpenseManager'),
  { ssr: false }
)

export default function ExpensesClient({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  return (
    <div className="expense-module">
      <ExpenseManager userName={userName} isAdmin={isAdmin} />
    </div>
  )
}
