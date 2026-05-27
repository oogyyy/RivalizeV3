import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        /* Primary CTA — pink gradient */
        default:
          'bg-gradient-to-br from-[#ff2d78] to-[#cc0060] text-white font-semibold hover:opacity-90 active:opacity-80 shadow-[0_0_18px_rgba(255,45,120,0.32)]',

        /* Destructive */
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',

        /* Neutral outlined */
        outline:
          'border border-[rgba(255,255,255,0.12)] bg-transparent text-foreground hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.2)]',

        /* Filled secondary */
        secondary:
          'bg-[rgba(255,255,255,0.07)] text-foreground border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.18)]',

        /* Ghost */
        ghost:
          'text-muted-foreground hover:bg-[rgba(255,255,255,0.06)] hover:text-foreground',

        /* Text link */
        link:
          'text-[#ff2d78] underline-offset-4 hover:underline p-0 h-auto',

        /* Pink accent — same as default */
        neon:
          'bg-gradient-to-br from-[#ff2d78] to-[#cc0060] text-white font-semibold hover:opacity-90 shadow-[0_0_18px_rgba(255,45,120,0.32)]',

        /* Brand ghost */
        'brand-ghost':
          'text-[#ff2d78] hover:bg-[rgba(255,45,120,0.08)] active:bg-[rgba(255,45,120,0.12)]',

        /* Brand outline */
        'brand-outline':
          'border border-[rgba(255,45,120,0.4)] text-[#ff2d78] hover:bg-[rgba(255,45,120,0.08)] hover:border-[rgba(255,45,120,0.6)]',
      },
      size: {
        sm:        'h-[28px] px-2.5 text-xs rounded-md',
        default:   'h-9 px-4',
        lg:        'h-11 px-5 text-[15px] rounded-lg',
        xl:        'h-12 px-6 text-base rounded-lg',
        icon:      'h-8 w-8 p-0 rounded-md',
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
