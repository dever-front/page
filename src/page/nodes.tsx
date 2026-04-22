/**
 * Nodes.tsx - 节点挂载与渲染
 * 根据 layoutId 找到 items 列表
 * 按 item.type 查注册表渲染节点组件
 * 统一处理 mode 包裹和 value/option/action 绑定
 */
import { useCallback } from 'react'
import { useStore } from 'zustand'
import {
  usePageStore,
  type PageStore,
  useStorePathValue,
} from '@/lib/store'
import { nodeRegistry } from '@/lib/registry'
import { runActions } from '@/lib/action'
import type { Item, OptionItem } from '@/lib/schema'
import { cn } from '@/lib/utils'
import {
  isItemCurrentlyHidden,
  isItemCurrentlyRequired,
} from '@/lib/condition'
import { useCanUseItem } from '@/lib/permission-infer'
import { Label } from '@/components/ui/label'
import { InlineTip } from '@/page/nodes/show/tooltip'
import { useNodeOption } from '@/page/option'

// ========== 统一节点 Props ==========

export type NodeItemProps = {
  item: Item
  value: any
  setValue: (value: any) => void
  option?: OptionItem[]
  optionLoading?: boolean
  ensureOptionLoaded?: (keyword?: string, selectedValue?: unknown) => Promise<OptionItem[] | undefined>
  runAction: (name: string) => Promise<void>
  store: PageStore
  layoutId: string
  error?: string
}

// ========== NodeList: 渲染某个 layout 下的所有 nodes ==========

type NodeListProps = {
  layoutId: string
}

export function NodeList({ layoutId }: NodeListProps) {
  const store = usePageStore()
  const items = useStore(store, (s) => s.schema.nodes?.[layoutId])

  if (!items || items.length === 0) return null

  return (
    <>
      {items.map((item: Item) => (
        <NodeItem key={item.id} item={item} store={store} layoutId={layoutId} />
      ))}
    </>
  )
}

// ========== NodeItem: 渲染单个节点 ==========

type NodeItemComponentProps = {
  item: Item
  store: PageStore
  layoutId: string
}

function NodeItem({ item, store, layoutId }: NodeItemComponentProps) {
  // 从注册表查找节点组件
  const NodeComponent = nodeRegistry[item.type]
  if (!NodeComponent) {
    console.warn('[Nodes] 未注册的节点类型:', item.type)
    return null
  }

  // 绑定 value
  const value = useNodeValue(store, item.value)
  const setValue = useNodeSetValue(store, item)
  const error = useNodeError(store, item.id)
  const required = useNodeRequired(store, item)
  const hidden = useNodeHidden(store, item)
  const allowed = useCanUseItem(store, item)

  // 解析 option
  const {
    option,
    optionLoading,
    ensureOptionLoaded,
  } = useNodeOption(store, item.option, item)

  // 绑定 action
  const handleAction = useCallback(
    async (name: string) => {
      await runActions(store, name)
    },
    [store]
  )

  // 组装 props
  const props: NodeItemProps = {
    item,
    value,
    setValue,
    option,
    optionLoading,
    ensureOptionLoaded,
    runAction: handleAction,
    store,
    layoutId,
    error,
  }

  if (hidden || !allowed) {
    return null
  }

  // 统一 mode 包裹
  return (
    <ModeWrapper item={item} error={error} required={required}>
      <NodeComponent {...props} />
    </ModeWrapper>
  )
}

// ========== Mode 包裹 ==========

function ModeWrapper({
  item,
  error,
  required,
  children,
}: {
  item: Item
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  const mode = item.mode

  if (mode === 'form') {
    if (item.meta?.formLayout === 'horizontal') {
      const hasHelperText = Boolean(error || item.info)

      return (
        <div
          className={cn(
            'mb-4 grid gap-x-3 gap-y-0.5 md:grid-cols-[7rem_minmax(0,1fr)] last:mb-0',
            item.className
          )}
        >
          <div className="md:flex md:min-h-10 md:items-center">
            {item.name ? (
              <Label
                htmlFor={item.id}
                className={cn(
                  'block text-sm font-medium',
                  error ? 'text-destructive' : 'text-foreground'
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{item.name}</span>
                  {required ? <span className="text-destructive">*</span> : null}
                  <InlineTip content={item.tip} />
                </span>
              </Label>
            ) : null}
          </div>
          <div className="min-w-0 md:flex md:min-h-10 md:items-center">{children}</div>
          {hasHelperText ? (
            <div className="min-w-0 space-y-0.5 md:col-start-2">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {item.info && (
                <p className="text-xs leading-5 text-muted-foreground">{item.info}</p>
              )}
            </div>
          ) : null}
        </div>
      )
    }

    return (
      <div className={cn('mb-4 space-y-2 last:mb-0', item.className)}>
        {item.name && (
          <Label
            htmlFor={item.id}
            className={cn('text-sm font-medium', error ? 'text-destructive' : undefined)}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{item.name}</span>
              {required ? <span className="text-destructive">*</span> : null}
              <InlineTip content={item.tip} />
            </span>
          </Label>
        )}
        {children}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {item.info && (
          <p className="text-xs text-muted-foreground">{item.info}</p>
        )}
      </div>
    )
  }

  if (mode === 'search') {
    const searchClassName = resolveSearchItemClassName(item)

    return <div className={cn(searchClassName, item.className)}>{children}</div>
  }

  // table / 无 mode：直接渲染
  if (item.className) {
    return <div className={item.className}>{children}</div>
  }

  return <>{children}</>
}

function resolveSearchItemClassName(item: Item) {
  switch (item.type) {
    case 'form-input':
      return 'w-full sm:max-w-[12rem]'
    case 'form-select':
      // JSON 是运行时协议，宽度类放在组件层枚举，避免 Tailwind 漏生成动态类。
      return item.meta?.searchWidth === 'wide' ? 'min-w-[16rem]' : 'min-w-[12rem]'
    case 'form-date':
      return 'min-w-[10rem]'
    default:
      return undefined
  }
}

// ========== Hooks ==========

/**
 * 从 store 读取节点的 value
 */
function useNodeValue(store: PageStore, valuePath?: string): any {
  return useStorePathValue(store, valuePath)
}

/**
 * 返回 setValue 函数
 */
function useNodeSetValue(store: PageStore, item: Item) {
  return useCallback(
    (newValue: any) => {
      if (!item.value) return
      store.getState().setValueByPath(item.value, newValue)
      if (item.validate?.length) {
        store.getState().validateItem(item)
      }
    },
    [item, store]
  )
}

function useNodeError(store: PageStore, itemId?: string) {
  return useStore(store, (s) => {
    if (!itemId) return ''
    return s.errors[itemId] ?? ''
  })
}

function useNodeRequired(store: PageStore, item: Item) {
  return useStore(store, (s) =>
    isItemCurrentlyRequired(
      item,
      s.data,
      s.state,
      s.parentStore
        ? {
            data: s.parentStore.getState().data,
            state: s.parentStore.getState().state,
          }
        : null
    )
  )
}

function useNodeHidden(store: PageStore, item: Item) {
  return useStore(store, (s) =>
    isItemCurrentlyHidden(
      item,
      s.data,
      s.state,
      s.parentStore
        ? {
            data: s.parentStore.getState().data,
            state: s.parentStore.getState().state,
          }
        : null
    )
  )
}
