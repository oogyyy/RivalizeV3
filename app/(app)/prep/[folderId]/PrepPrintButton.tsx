'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PrepPrintButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-2"
      onClick={() => window.print()}
    >
      <Printer size={14} />
      Print / Save PDF
    </Button>
  )
}
