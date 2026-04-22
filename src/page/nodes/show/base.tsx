/**
 * Show/Base.tsx - 基础值展示
 */
import { formatDisplayValue } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

export function ShowBase({ item, value }: NodeItemProps) {
  if (value == null) return null
  const text = formatDisplayValue(value, item.meta?.format)
  if (!text) {
    return null
  }
  return <span>{text}</span>
}
