/**
 * Show/Tag.tsx - 标签展示
 */
import { Badge } from '@/components/ui/badge'
import type { NodeItemProps } from '../../nodes'
import { resolveOptionDisplayTexts } from './option-text'

export function ShowTag({ item, value, option }: NodeItemProps) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  const texts = resolveOptionDisplayTexts(value, option, {
    field: String(item.meta?.field || ''),
    cases: Array.isArray(item.meta?.cases) ? item.meta.cases : [],
  })

  // 从 meta 读取 variant
  if (item.meta?.variant) {
    variant = item.meta.variant
  }

  if (texts.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1">
      {texts.map((text, index) => (
        <Badge key={`${text}-${index}`} variant={variant}>
          {text}
        </Badge>
      ))}
    </div>
  )
}
