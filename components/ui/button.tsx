import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        /* Primary CTA */
        default:
          'bg-primary text-white shadow-[0_0_18px_rgba(255,45,120,0.28)] hover:opacity-90 active:scale-[0.98]',

        /* Pink accent — alias of default */
        neon:
          'bg-primary text-white shadow-[0_0_18px_rgba(255,45,120,0.28)] hover:opacity-90 active:scale-[0.98]',

        /* Filled secondary */
        secondary:
          'bg-white/[0.07] text-foreground border border-white/[0.09] hover:bg-white/[0.10] hover:border-white/[0.14]',

        /* Ghost */
        ghost:
          'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]',

        /* Destructive */
        destructive:
          'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20',

        /* Neutral outlined */
        outline:
          'border border-border bg-transparent text-foreground hover:bg-white/[0.05]',

        /* Text link */
        link:
          'text-primary underline-offset-4 hover:underline h-auto p-0',

        /* Brand ghost — alias of ghost */
        'brand-ghost':
          'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]',

        /* Brand outline — alias of outline */
        'brand-outline':
          'border border-border bg-transparent text-foreground hover:bg-white/[0.05]',
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
