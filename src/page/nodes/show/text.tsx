/**
 * Show/Text.tsx - 文本展示
 */
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

export function ShowText({ item, value }: NodeItemProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', item.className)}>
      {value != null ? String(value) : item.name || ''}
    </p>
  )
}
