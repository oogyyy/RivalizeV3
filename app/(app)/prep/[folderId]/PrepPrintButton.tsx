'use client'

import { Printer, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function PrepPrintButton({ plan }: { plan?: 'pro' | 'team' | null }) {
  if (plan === 'team') {
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

  return (
    <Button variant="secondary" size="sm" className="gap-2 opacity-60 cursor-not-allowed" asChild>
      <Link href="/pricing">
        <Lock size={14} />
        PDF Export — Team Plan
      </Link>
    </Button>
  )
}
