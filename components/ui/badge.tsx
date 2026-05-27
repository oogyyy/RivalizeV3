import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#ff2d78] text-white',
        secondary:
          'border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.55)]',
        destructive:
          'bg-[rgba(255,64,64,0.12)] text-[#ff4040] border border-[rgba(255,64,64,0.28)]',
        outline:
          'border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.44)]',

        /* Success / analyzed */
        neon:
          'border border-[rgba(0,255,200,0.28)] bg-[rgba(0,255,200,0.1)] text-[#00ffc8]',
        success:
          'border border-[rgba(0,200,100,0.28)] bg-[rgba(0,200,100,0.12)] text-[#00c864]',

        /* Warning / processing */
        warning:
          'border border-[rgba(255,165,0,0.3)] bg-[rgba(255,165,0,0.14)] text-[#ffaa00]',
        processing:
          'border border-[rgba(255,165,0,0.3)] bg-[rgba(255,165,0,0.14)] text-[#ffaa00]',

        /* Info / blue */
        blue:
          'border border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.1)] text-blue-400',

        /* Purple */
        purple:
          'border border-[rgba(155,29,255,0.28)] bg-[rgba(155,29,255,0.1)] text-[#a46dff]',

        /* CS2 side badges */
        tside:
          'border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] text-amber-400',
        ctside:
          'border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.1)] text-blue-400',
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
