/**
 * Show/Tag.tsx - 标签展示
 */
import { Badge } from '@/components/ui/badge'
import { getByPath } from '@/lib/path'
import type { NodeItemProps } from '../../nodes'

export function ShowTag({ item, value, option }: NodeItemProps) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  const texts = resolveTagTexts(value, option, String(item.meta?.field || ''))

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

function resolveTagTexts(value: any, option: NodeItemProps['option'], field: string) {
  if (Array.isArray(value)) {
    return value
      .map((current) => resolveSingleTagText(current, option, field))
      .filter((current): current is string => !!current)
  }

  const single = resolveSingleTagText(value, option, field)
  return single ? [single] : []
}

function resolveSingleTagText(value: any, option: NodeItemProps['option'], field: string) {
  if (value == null || value === '') {
    return ''
  }

  if (typeof value === 'object') {
    if (field) {
      const fieldValue = getByPath(value, field)
      if (fieldValue != null && fieldValue !== '') {
        return String(fieldValue)
      }
    }

    for (const key of ['label', 'value', 'name', 'id']) {
      if (value[key] != null && value[key] !== '') {
        return String(value[key])
      }
    }

    return ''
  }

  if (Array.isArray(option)) {
    const found = option.find((current) => String(current.id) === String(value))
    if (found) {
      return found.value
    }
  }

  return String(value)
}
