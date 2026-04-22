/**
 * Container.tsx - 容器布局
 * 作为 Fragment 包裹，不添加额外 DOM
 */
import { cn } from '@/lib/utils'
import type { LayoutComponentProps } from './types'

export function Container({ config, children }: LayoutComponentProps) {
  // 如果有 className，用 div 包裹
  if (config.className) {
    return (
      <div className={cn(config.className)}>
        {children}
      </div>
    )
  }
  // 否则直接 Fragment
  return <>{children}</>
}
