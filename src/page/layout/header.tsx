/**
 * Header.tsx - 顶部栏布局
 * 页面级标题条，位于全局顶栏下方
 */
import { cn } from '@/lib/utils'
import type { LayoutComponentProps } from './types'

export function Header({ config, children }: LayoutComponentProps) {
  return (
    <section
      className={cn(
        'border-b border-border/60 bg-background px-4 py-3 sm:px-5',
        config.className
      )}
    >
      <div className='flex min-h-12 min-w-0 items-center gap-3'>{children}</div>
    </section>
  )
}
