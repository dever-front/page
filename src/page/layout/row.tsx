/**
 * Row.tsx - 栅格行
 */
import { cn } from '@/lib/utils'
import type { LayoutComponentProps } from './types'

export function Row({ config, children }: LayoutComponentProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-4',
        config.className
      )}
    >
      {children}
    </div>
  )
}
