'use client'

import { useState } from 'react'
import { Button } from '@/components/marketing/ui/button'
import { Plus } from 'lucide-react'
import LeadFormModal from '@/components/marketing/leads/lead-form-modal'

interface Props {
  dataSourceSuggestions: string[]
  industrySuggestions: string[]
  serviceSuggestions: string[]
  assigneeSuggestions: string[]
}

export default function AddLeadForm(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-1.5 font-bold rounded-xl border-0 text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500"
      >
        <Plus className="h-4 w-4" /> Add Lead
      </Button>
      <LeadFormModal open={open} onClose={() => setOpen(false)} initial={null} {...props} />
    </>
  )
}
