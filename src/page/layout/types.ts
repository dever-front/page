/**
 * Layout 组件统一 Props 类型
 */
import type { LayoutNode } from '@/lib/schema'

export type LayoutComponentProps = {
  layoutId: string
  config: LayoutNode
  children?: React.ReactNode
}
