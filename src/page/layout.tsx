/**
 * Layout.tsx - 布局递归渲染
 * 直接按树结构递归渲染 layout
 */
import { useMemo } from 'react'
import { usePageStore, type PageStore, useStorePathValue } from '@/lib/store'
import { layoutRegistry } from '@/lib/registry'
import type { LayoutNode as LayoutNodeType } from '@/lib/schema'
import { NodeList } from './nodes'
import { Page } from './page'

type LayoutRendererProps = {
  config: LayoutNodeType
  layoutId?: string
}

export function LayoutRenderer({
  config,
  layoutId = '__root__',
}: LayoutRendererProps) {
  const store = usePageStore()
  return <LayoutNodeRenderer layoutId={layoutId} config={config} store={store} />
}

type LayoutNodeRendererProps = {
  layoutId: string
  config: LayoutNodeType
  store: PageStore
}

function LayoutNodeRenderer({ layoutId, config, store }: LayoutNodeRendererProps) {
  const LayoutComponent = layoutRegistry[config.type]

  if (!LayoutComponent) {
    console.warn('[Layout] 未注册的布局类型:', config.type)
    return null
  }

  const resolvedPath = useResolvedPath(store, config.path)

  const childrenElements = useMemo(() => {
    if (!config.children) return null
    return Object.entries(config.children).map(([childId, childConfig]) => (
      <LayoutNodeRenderer key={childId} layoutId={childId} config={childConfig} store={store} />
    ))
  }, [config.children, store])

  const content = resolvedPath ? (
    <Page
      route={resolvedPath}
      parentStore={store}
      updateDocumentTitle={config.meta?.updateDocumentTitle !== false}
    />
  ) : (
    <>
      <NodeList layoutId={layoutId} />
      {childrenElements}
    </>
  )

  return (
    <LayoutComponent layoutId={layoutId} config={config}>
      {content}
    </LayoutComponent>
  )
}

function useResolvedPath(store: PageStore, path?: string): string | undefined {
  const resolvedValue = useStorePathValue(
    store,
    path && !path.startsWith('/') ? path : undefined
  )

  if (!path) {
    return undefined
  }

  if (path.startsWith('/')) {
    return path
  }

  return typeof resolvedValue === 'string' ? resolvedValue : undefined
}
