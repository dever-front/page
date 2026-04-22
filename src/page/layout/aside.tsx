/**
 * Aside.tsx - 侧边栏布局
 * 后台侧边栏容器
 */
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LayoutComponentProps } from './types'

export function Aside({ config, children }: LayoutComponentProps) {
  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col border-r bg-sidebar',
        config.className
      )}
    >
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-3">
          {children}
        </nav>
      </ScrollArea>
    </aside>
  )
}
