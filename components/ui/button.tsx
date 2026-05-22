import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        /* Primary brand CTA */
        default:
          'bg-[#10D9A0] text-[#0B0D14] font-semibold hover:bg-[#0DBF8C] active:bg-[#0AA87A] shadow-[0_1px_2px_rgba(0,0,0,0.3)]',

        /* Destructive */
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',

        /* Neutral outlined */
        outline:
          'border border-border bg-transparent text-foreground hover:bg-accent hover:border-[hsl(221,22%,22%)] active:bg-muted',

        /* Filled secondary surface */
        secondary:
          'bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-[hsl(221,22%,22%)]',

        /* Ghost — for inline/low-priority actions */
        ghost:
          'text-muted-foreground hover:bg-accent hover:text-foreground active:bg-muted',

        /* Text link style */
        link:
          'text-primary underline-offset-4 hover:underline p-0 h-auto',

        /* Brand outlined */
        neon:
          'bg-[#10D9A0] text-[#0B0D14] font-semibold hover:bg-[#0DBF8C] active:bg-[#0AA87A] shadow-[0_0_16px_rgba(16,217,160,0.2)]',

        /* Brand ghost — subtle brand accent */
        'brand-ghost':
          'text-[#10D9A0] hover:bg-[rgba(16,217,160,0.08)] active:bg-[rgba(16,217,160,0.12)]',

        /* Brand outline */
        'brand-outline':
          'border border-[rgba(16,217,160,0.4)] text-[#10D9A0] hover:bg-[rgba(16,217,160,0.08)] hover:border-[rgba(16,217,160,0.6)]',
      },
      size: {
        sm:      'h-[28px] px-2.5 text-xs rounded-md',
        default: 'h-9 px-4',
        lg:      'h-11 px-5 text-[15px] rounded-lg',
        xl:      'h-12 px-6 text-base rounded-lg',
        icon:    'h-8 w-8 p-0 rounded-md',
        'icon-sm': 'h-7 w-7 p-0 rounded',
        'icon-lg': 'h-10 w-10 p-0 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
