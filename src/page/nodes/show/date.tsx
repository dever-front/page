/**
 * Show/Date.tsx - 日期时间展示
 */
import { formatDisplayValue } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

export function ShowDate({ item, value }: NodeItemProps) {
  const format = String(item.meta?.format || 'datetime-minute')
  const text = formatDisplayValue(value, format)
  if (!text) {
    return null
  }
  return <span className="whitespace-nowrap">{text}</span>
}
