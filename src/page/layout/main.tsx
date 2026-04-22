/**
 * Main.tsx - 主内容区布局
 * 复用项目通用 Main 容器
 */
import { Main as AppMain } from '@/components/layout/main'
import type { LayoutComponentProps } from './types'

export function Main({ config, children }: LayoutComponentProps) {
  return (
    <AppMain
      fixed={config.meta?.fixed}
      fluid={config.meta?.fluid}
      className={config.className}
    >
      {children}
    </AppMain>
  )
}
