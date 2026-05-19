/**
 * Show/Link.tsx - 链接/按钮节点
 * 触发 action，支持菜单激活状态
 */
import { useStore } from 'zustand'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getStoreValueByPath } from '@/lib/store'
import { stripRouterBasePath } from '@/lib/router-path'
import type { NodeItemProps } from '../../nodes'

export function ShowLink({ item, value, runAction, store }: NodeItemProps) {
  const navigate = useNavigate()

  const handleClick = async () => {
    if (item.meta?.to) {
      navigate({ to: stripRouterBasePath(item.meta.to) })
      return
    }

    if (item.action?.click) {
      const actions = item.action.click
      if (Array.isArray(actions)) {
        for (const a of actions) {
          await runAction(a)
        }
      } else {
        await runAction(actions)
      }
    }
  }

  // 侧边栏菜单样式
  const isMenuItem = item.meta?.menuItem
  const isTabItem = item.meta?.tabItem

  // 动态计算激活状态：通过 action 配置中的 target/value 和 store 当前值比较
  const isActive = useMenuActive(store, item)

  if (isMenuItem) {
    return (
      <button
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground',
          item.className
        )}
        onClick={handleClick}
      >
        {item.name || value || ''}
      </button>
    )
  }

  if (item.meta?.to) {
    return (
      <Button
        variant={item.meta?.variant || 'ghost'}
        size={item.meta?.size || 'sm'}
        className={cn(item.className)}
        onClick={handleClick}
      >
        {item.name || value || ''}
      </Button>
    )
  }

  return (
    <Button
      variant={
        isTabItem
          ? (isActive ? item.meta?.activeVariant : item.meta?.inactiveVariant) ||
            (isActive ? 'secondary' : 'outline')
          : item.meta?.variant || 'ghost'
      }
      size={item.meta?.size || 'sm'}
      className={cn(
        isTabItem &&
          (isActive
            ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground dark:border-primary/30'
            : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'),
        isTabItem && !isActive && 'opacity-85',
        item.className
      )}
      onClick={handleClick}
    >
      {item.name || value || ''}
    </Button>
  )
}

/**
 * 动态判断菜单项是否激活
 * 通过 action 配置反推：如果 action.click 指向的 action 的 target 和 value
 * 与 store 中的当前值匹配，则认为是激活的
 */
function useMenuActive(store: NodeItemProps['store'], item: NodeItemProps['item']): boolean {
  return useStore(store, (s) => {
    if (!item.action?.click) return false
    const actionName = Array.isArray(item.action.click)
      ? item.action.click[0]
      : item.action.click
    const actionConfig = s.action[actionName]
    if (!actionConfig || !actionConfig.target || actionConfig.value === undefined) return false

    const currentValue = getStoreValueByPath(store, actionConfig.target)

    return currentValue === actionConfig.value
  })
}
