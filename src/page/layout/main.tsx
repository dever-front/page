/**
 * Main.tsx - 主内容区布局
 * 复用项目通用 Main 容器
 */
import { useStore } from 'zustand'
import { usePageStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Main as AppMain } from '@/components/layout/main'
import type { LayoutComponentProps } from './types'

export function Main({ config, children }: LayoutComponentProps) {
  const store = usePageStore()
  const isNestedPage = useStore(store, (state) => !!state.parentStore)

  return (
    <AppMain
      fixed={config.meta?.fixed}
      fluid={config.meta?.fluid}
      className={cn(
        config.className,
        isNestedPage && config.meta?.nestedClassName
      )}
    >
      {children}
    </AppMain>
  )
}
