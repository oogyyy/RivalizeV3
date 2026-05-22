import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground',
        secondary:
          'border-border bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive/15 text-destructive border-destructive/25',
        outline:
          'border-border text-muted-foreground',

        /* Brand / success */
        neon:
          'border-[rgba(16,217,160,0.25)] bg-[rgba(16,217,160,0.1)] text-[#10D9A0]',
        success:
          'border-[rgba(16,217,160,0.25)] bg-[rgba(16,217,160,0.1)] text-[#10D9A0]',

        /* Warning */
        warning:
          'border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.1)] text-amber-400',

        /* Info / blue */
        processing:
          'border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.1)] text-blue-400',
        blue:
          'border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.1)] text-blue-400',

        /* Purple */
        purple:
          'border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.1)] text-violet-400',

        /* CS2 side badges */
        tside:
          'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] text-amber-400',
        ctside:
          'border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.1)] text-blue-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
