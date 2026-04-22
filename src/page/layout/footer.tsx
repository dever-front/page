/**
 * Footer.tsx - 底部栏布局
 */
import { cn } from '@/lib/utils'
import type { LayoutComponentProps } from './types'

export function Footer({ config, children }: LayoutComponentProps) {
  return (
    <footer
      className={cn(
        'flex shrink-0 items-center border-t bg-background px-4 py-3 text-sm text-muted-foreground',
        config.className
      )}
    >
      {children}
    </footer>
  )
}
