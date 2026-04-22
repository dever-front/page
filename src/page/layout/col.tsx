/**
 * Col.tsx - 栅格列
 * value 指定 12 栅格宽度
 */
import { cn } from '@/lib/utils'
import type { LayoutComponentProps } from './types'

// 12 栅格宽度映射
const colWidths: Record<string, string> = {
  '1': 'w-1/12',
  '2': 'w-2/12',
  '3': 'w-3/12',
  '4': 'w-4/12',
  '5': 'w-5/12',
  '6': 'w-6/12',
  '7': 'w-7/12',
  '8': 'w-8/12',
  '9': 'w-9/12',
  '10': 'w-10/12',
  '11': 'w-11/12',
  '12': 'w-full',
}

export function Col({ config, children }: LayoutComponentProps) {
  const widthClass = config.value ? colWidths[config.value] || 'w-full' : 'flex-1'

  return (
    <div
      className={cn(
        widthClass,
        config.className
      )}
    >
      {children}
    </div>
  )
}
