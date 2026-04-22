import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type SelectTriggerShellProps = {
  children: ReactNode
  clearable?: boolean
  hasValue?: boolean
  disabled?: boolean
  className?: string
  clearButtonClassName?: string
  onClear?: () => void
}

export function SelectTriggerShell({
  children,
  clearable = true,
  hasValue = false,
  disabled = false,
  className,
  clearButtonClassName,
  onClear,
}: SelectTriggerShellProps) {
  const canClear = clearable && hasValue && !disabled && !!onClear

  return (
    <div
      className={cn(
        'group/select-trigger relative w-full',
        canClear &&
          '[&_.select-trigger-chevron]:transition-opacity [&_.select-trigger-chevron]:duration-150 hover:[&_.select-trigger-chevron]:opacity-0 focus-within:[&_.select-trigger-chevron]:opacity-0',
        className
      )}
    >
      {children}
      {canClear ? (
        <button
          type="button"
          aria-label="清除当前选项"
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 z-10 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-sm bg-background text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover/select-trigger:pointer-events-auto group-hover/select-trigger:opacity-100 group-focus-within/select-trigger:pointer-events-auto group-focus-within/select-trigger:opacity-100',
            clearButtonClassName
          )}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClear?.()
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
