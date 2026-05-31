import { cn } from '@/lib/utils'
import { SidebarInset } from '@/components/ui/sidebar'
import type { LayoutComponentProps } from './types'

export function ShellSidebarInset({ config, children }: LayoutComponentProps) {
  return (
    <SidebarInset
      className={cn(
        '@container/content',
        'has-data-[layout=fixed]:h-svh',
        'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]',
        config.className
      )}
    >
      {children}
    </SidebarInset>
  )
}
