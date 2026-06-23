export type Expense = {
  id: string
  description: string
  category: string
  amount: number
  currency: 'USD' | 'INR'
  expense_date: string
  city: 'lv' | 'or' | 'tx' | 'nj'
  notes: string
  receipt_urls: string[]
  inr_equivalent: number | null
  added_by: string
  created_at: string
}
