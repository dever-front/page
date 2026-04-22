/**
 * Show/Icon.tsx - 图标展示
 * 使用 lucide-react
 */
import type { NodeItemProps } from '../../nodes'
import { resolveLucideIcon } from '@/lib/icon'

export function ShowIcon({ item, value }: NodeItemProps) {
  const iconName = (value || item.meta?.icon || '') as string

  // 从 lucide-react 动态查找图标
  const Icon = resolveLucideIcon(iconName)

  if (!Icon) {
    return <span>{iconName}</span>
  }

  const size = item.meta?.size || 16

  return <Icon size={size} />
}
