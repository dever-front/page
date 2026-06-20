/**
 * Nodes.tsx - 节点挂载与渲染
 * 根据 layoutId 找到 items 列表
 * 按 item.type 查注册表渲染节点组件
 * 统一处理 mode 包裹和 value/option/action 绑定
 */
import { Suspense, useCallback } from 'react'
import { InlineTip } from '@/page/nodes/show/tooltip'
import { useNodeOption } from '@/page/option'
import { useStore } from 'zustand'
import { runActions } from '@/lib/action'
import { isItemCurrentlyHidden, isItemCurrentlyRequired } from '@/lib/condition'
import {
  isSameControlValue,
  normalizeClearOnChangePaths,
} from '@/lib/form-control'
import { getNodeComponent } from '@/lib/registry'
import { getRuntimeNodeLoadError } from '@/lib/plugin/runtime'
import type { Item, OptionItem } from '@/lib/schema'
import { usePageStore, type PageStore, useStorePathValue } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

// ========== 统一节点 Props ==========

export type NodeItemProps = {
  item: Item
  value: any
  setValue: (value: any) => void
  option?: OptionItem[]
  optionLoading?: boolean
  ensureOptionLoaded?: (
    keyword?: string,
    selectedValue?: unknown
  ) => Promise<OptionItem[] | undefined>
  runAction: (name: string) => Promise<void>
  store: PageStore
  layoutId: string
  error?: string
  row?: Record<string, any>
  setRow?: (nextRow: Record<string, any>) => void
  assistantAdornment?: React.ReactNode
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
  // 绑定 value
  const value = useNodeValue(store, item.value)
  const setValue = useNodeSetValue(store, item)
  const error = useNodeError(store, item.id)
  const required = useNodeRequired(store, item)
  const hidden = useNodeHidden(store, item)

  // 解析 option
  const { option, optionLoading, ensureOptionLoaded } = useNodeOption(
    store,
    hidden ? undefined : item.option,
    item
  )

  // 绑定 action
  const handleAction = useCallback(
    async (name: string) => {
      await runActions(store, name)
    },
    [store]
  )

  // 从注册表查找节点组件
  const NodeComponent = getNodeComponent(item.type)

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

  if (hidden) {
    return null
  }

  if (!NodeComponent) {
    const message =
      getRuntimeNodeLoadError(item.type) ||
      `未注册的节点类型：${String(item.type || '').trim()}`
    console.warn('[Nodes] 未注册的节点类型:', item.type, message)
    return <MissingNodeFallback item={item} message={message} />
  }

  // 统一 mode 包裹
  return (
    <ModeWrapper item={item} error={error} required={required}>
      <Suspense fallback={<NodeFallback item={item} />}>
        <NodeComponent {...props} />
      </Suspense>
    </ModeWrapper>
  )
}

const silentFallbackNodeTypes = new Set([
  'app-skip-to-main',
  'app-sidebar',
  'app-topbar',
  'app-outlet',
  'app-assistant',
  'show-base',
  'show-title',
  'show-rich',
  'show-text',
  'show-date',
  'show-link',
  'show-button',
  'show-button-group',
  'show-tag',
  'show-select',
  'show-status',
  'show-icon',
  'show-tooltip',
])

function NodeFallback({ item }: { item: Item }) {
  const nodeType = String(item.type || '')
  if (
    nodeType.startsWith('feedback-') ||
    silentFallbackNodeTypes.has(nodeType)
  ) {
    return null
  }

  if (item.mode === 'search') {
    return <Skeleton className="h-10 w-full" />
  }

  if (item.type === 'form-textarea') {
    return <Skeleton className="min-h-28 w-full rounded-xl" />
  }

  if (item.type === 'form-editor') {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-background">
        <div className="flex h-11 items-center gap-2 border-b border-border/70 bg-muted/30 px-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-7" />
          ))}
        </div>
        <Skeleton className="m-4 h-48 rounded-lg" />
      </div>
    )
  }

  if (item.type === 'form-upload') {
    const uploadType = String(item.meta?.uploadType || '').trim()
    if (uploadType === 'pic' || uploadType === 'video' || uploadType === 'audio') {
      return (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="size-36 rounded-2xl" />
          ))}
        </div>
      )
    }
    return <Skeleton className="h-28 w-full rounded-xl" />
  }

  if (item.type === 'show-table') {
    return (
      <div className="w-full rounded-xl border border-border/70 bg-background p-3">
        <Skeleton className="mb-3 h-8 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="mb-2 h-9 w-full last:mb-0" />
        ))}
      </div>
    )
  }

  if (item.type === 'show-chart') {
    return <Skeleton className="h-64 w-full rounded-xl" />
  }

  if (item.type === 'type-editor') {
    return (
      <div className="grid min-h-[22rem] gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Skeleton className="h-80 rounded-md" />
        <Skeleton className="h-80 rounded-md" />
      </div>
    )
  }

  if (item.mode === 'form') {
    return <Skeleton className="h-10 w-full" />
  }

  return null
}

function MissingNodeFallback({
  item,
  message,
}: {
  item: Item
  message: string
}) {
  const content = message || `未注册的节点类型：${String(item.type || '').trim()}`

  if (item.mode === 'form') {
    return (
      <ModeWrapper item={item}>
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {content}
        </p>
      </ModeWrapper>
    )
  }

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {content}
    </div>
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
    const formLayout = item.meta?.formLayout ?? 'horizontal'

    if (formLayout === 'horizontal') {
      const hasHelperText = Boolean(error || item.info)

      return (
        <div
          className={cn(
            'mb-4 grid gap-x-3 gap-y-0.5 last:mb-0 md:grid-cols-[7rem_minmax(0,1fr)]',
            item.className
          )}
        >
          <div className='md:flex md:min-h-10 md:items-center'>
            {item.name ? (
              <Label
                htmlFor={item.id}
                className={cn(
                  'block text-sm font-medium',
                  error ? 'text-destructive' : 'text-foreground'
                )}
              >
                <span className='inline-flex items-center gap-1.5'>
                  <span>{item.name}</span>
                  {required ? (
                    <span className='text-destructive'>*</span>
                  ) : null}
                  <InlineTip content={item.tip} />
                </span>
              </Label>
            ) : null}
          </div>
          <div className='min-w-0 md:flex md:min-h-10 md:items-center'>
            {children}
          </div>
          {hasHelperText ? (
            <div className='min-w-0 space-y-0.5 md:col-start-2'>
              {error && <p className='text-sm text-destructive'>{error}</p>}
              {item.info && (
                <p className='text-xs leading-5 text-muted-foreground'>
                  {item.info}
                </p>
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
            className={cn(
              'text-sm font-medium',
              error ? 'text-destructive' : undefined
            )}
          >
            <span className='inline-flex items-center gap-1.5'>
              <span>{item.name}</span>
              {required ? <span className='text-destructive'>*</span> : null}
              <InlineTip content={item.tip} />
            </span>
          </Label>
        )}
        {children}
        {error && <p className='text-sm text-destructive'>{error}</p>}
        {item.info && (
          <p className='text-xs text-muted-foreground'>{item.info}</p>
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
      return item.meta?.searchWidth === 'wide'
        ? 'min-w-[16rem]'
        : 'min-w-[12rem]'
    case 'form-date':
      if (item.meta?.searchWidth === 'select') {
        return 'min-w-[12rem]'
      }
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
      const previousValue = store.getState().getValueByPath(item.value)
      store.getState().setValueByPath(item.value, newValue)
      if (!isSameControlValue(previousValue, newValue)) {
        clearDependentValues(store, item)
      }
      if (item.validate?.length) {
        store.getState().validateItem(item)
      }
    },
    [item, store]
  )
}

function clearDependentValues(store: PageStore, item: Item) {
  const clearPaths = normalizeClearOnChangePaths(item.meta?.clearOnChange)
  for (const path of clearPaths) {
    if (path && path !== item.value) {
      store.getState().setValueByPath(path, '')
    }
  }
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
