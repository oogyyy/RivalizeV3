import React from 'react'

interface PageHeaderProps {
  label: string
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ label, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5 border-b border-border/60">
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {label}
        </p>
        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-0.5">{actions}</div>
      )}
    </div>
  )
}
