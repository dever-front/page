/**
 * Show/Rich.tsx - 富文本展示
 */
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

export function ShowRich({ item, value }: NodeItemProps) {
  if (value == null) return null
  const preview = item.meta?.preview === true || item.meta?.variant === 'preview'

  return (
    <div
      className={cn(
        'min-w-0 text-sm leading-6 text-foreground [&_a]:underline [&_p]:my-0',
        preview && 'line-clamp-2 max-w-full overflow-hidden [&_*]:inline [&_br]:hidden',
        item.className
      )}
      dangerouslySetInnerHTML={{ __html: String(value) }}
    />
  )
}
