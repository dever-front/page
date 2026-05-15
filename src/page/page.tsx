/**
 * Page.tsx - 页面入口与运行时装载
 * 根据 route 或 schema 获取页面 JSON
 * 创建独立 store，初始化数据，执行 init actions
 * 渲染根布局
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { validatePageSchema, type PageSchemaType } from '@/lib/schema'
import { createPageStore, PageStoreContext, type PageStore } from '@/lib/store'
import { runAction } from '@/lib/action'
import {
  finishPageReload,
  isSamePageReloadRoute,
  PAGE_RELOAD_EVENT,
  type PageReloadDetail,
} from '@/lib/page-reload'
import { loadPageSchema } from '@/lib/request'
import { getSiteConfig } from '@/config/app-config'
import {
  activateAssistantPage,
  registerAssistantPage,
  type AssistantPageScope,
} from '@/lib/assistant/registry'
import {
  finishPageProgress,
  startPageProgress,
} from '@/lib/page-progress'
import {
  getActiveRouteNavigationKey,
  getCurrentRouteNavigationKey,
  normalizeRouteKey,
} from '@/lib/route-key'
import { preloadNodeComponents } from '@/lib/registry'
import { LayoutRenderer } from './layout'

type PageProps = {
  route?: string
  schema?: any
  parentStore?: PageStore | null
  onStoreReady?: (store: PageStore | null) => void
  assistantScope?: AssistantPageScope
  updateDocumentTitle?: boolean
}

const LINKED_PAGE_PRELOAD_MAX_DEPTH = 3

function formatDocumentTitle(pageTitle?: string) {
  const currentTitle = String(pageTitle || '').trim()
  const siteName = String(getSiteConfig()?.name || '').trim()

  if (!siteName) {
    return currentTitle
  }
  if (!currentTitle || currentTitle === siteName) {
    return siteName
  }
  if (currentTitle.endsWith(` - ${siteName}`)) {
    return currentTitle
  }
  return `${currentTitle} - ${siteName}`
}

function buildPageLoadKey(route?: string, schema?: any) {
  if (schema) {
    const page = schema?.page && typeof schema.page === 'object' ? schema.page : {}
    return `schema:${page.route || page.id || page.name || page.title || 'inline'}`
  }

  return `route:${String(route || '').trim()}`
}

export function Page({
  route,
  schema: schemaProp,
  parentStore,
  onStoreReady,
  assistantScope,
  updateDocumentTitle = true,
}: PageProps) {
  const [pageSchema, setPageSchema] = useState<PageSchemaType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadedKey, setLoadedKey] = useState('')
  const [reloadVersion, setReloadVersion] = useState(0)
  const hasLoadedRef = useRef(false)
  const loadedKeyRef = useRef('')
  const loadKey = buildPageLoadKey(route, schemaProp)

  useEffect(() => {
    if (typeof window === 'undefined' || !route) {
      return
    }

    const handlePageReload = (event: Event) => {
      const customEvent = event as CustomEvent<PageReloadDetail>
      if (!isSamePageReloadRoute(route, customEvent.detail?.route || '')) {
        return
      }

      setReloadVersion((version) => version + 1)
    }

    window.addEventListener(PAGE_RELOAD_EVENT, handlePageReload)
    return () => {
      window.removeEventListener(PAGE_RELOAD_EVENT, handlePageReload)
    }
  }, [route])

  // 加载 schema
  useEffect(() => {
    let cancelled = false

    async function load() {
      const isNewPage = loadedKeyRef.current !== loadKey
      const routeProgressKey = normalizeRouteKey(route)
      const currentBrowserNavigationKey = getCurrentRouteNavigationKey()
      const currentBrowserRouteKey = currentBrowserNavigationKey.split('@')[0] || ''
      const activeNavigationKey = getActiveRouteNavigationKey()
      const progressRequestKey = reloadVersion > 0
        ? `${activeNavigationKey || currentBrowserNavigationKey}:reload:${reloadVersion}`
        : currentBrowserNavigationKey
      const shouldTrackProgress =
        !schemaProp &&
        !!routeProgressKey &&
        routeProgressKey === currentBrowserRouteKey &&
        currentBrowserNavigationKey === activeNavigationKey
      const progressToken = shouldTrackProgress
        ? startPageProgress(route || '', progressRequestKey)
        : ''
      setLoading(isNewPage || !hasLoadedRef.current)
      setError(null)

      try {
        let raw: any

        if (schemaProp) {
          // 优先使用传入的 schema
          raw = schemaProp
        } else if (route) {
          // 从远程加载
          raw = await loadPageSchema(route, {
            skipValueCache: reloadVersion > 0,
          })
        }

        if (cancelled) return

        if (!raw) {
          setError(`页面不存在: ${route}`)
          setLoading(false)
          return
        }

        const validated = validatePageSchema(raw)
        void preloadNodeComponents(validated)
        if (cancelled) return
        setPageSchema(validated)
        loadedKeyRef.current = loadKey
        setLoadedKey(loadKey)
        hasLoadedRef.current = true
        if (!schemaProp) {
          scheduleLinkedPageSchemaPreload(validated, route)
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[Page] Schema 校验失败:', err)
          setError(err.message || '页面加载失败')
        }
      } finally {
        if (progressToken) {
          finishPageProgress(progressToken)
        }
        if (route) {
          finishPageReload(route)
        }
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [
    loadKey,
    reloadVersion,
    route,
    schemaProp,
  ])

  const isStalePage = loadedKey !== loadKey

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-destructive">{error}</div>
      </div>
    )
  }

  if (loading || isStalePage) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!pageSchema) return null

  return (
    <PageInner
      schema={pageSchema}
      route={route}
      parentStore={parentStore}
      onStoreReady={onStoreReady}
      assistantScope={assistantScope}
      updateDocumentTitle={updateDocumentTitle}
    />
  )
}

async function preloadLinkedPageSchemas(
  schema: PageSchemaType,
  currentRoute?: string,
  visited = new Set<string>(),
  depth = 0
) {
  if (depth >= LINKED_PAGE_PRELOAD_MAX_DEPTH) {
    return
  }

  const currentKey = normalizeLinkedPageRouteKey(currentRoute)
  if (currentKey) {
    visited.add(currentKey)
  }

  const paths = collectStaticLinkedPagePaths(schema.layout)
    .filter((path) => {
      const key = normalizeLinkedPageRouteKey(path)
      return key && !visited.has(key)
    })

  if (paths.length === 0) {
    return
  }

  await Promise.all(
    paths.map(async (path) => {
      const key = normalizeLinkedPageRouteKey(path)
      if (!key || visited.has(key)) {
        return
      }
      visited.add(key)

      try {
        const linkedSchema = await loadPageSchema(path)
        if (!linkedSchema) {
          return
        }
        const validated = validatePageSchema(linkedSchema)
        void preloadNodeComponents(validated)
        await preloadLinkedPageSchemas(validated, path, visited, depth + 1)
      } catch (error) {
        console.warn('[Page] 子页面预加载校验失败:', path, error)
      }
    })
  )
}

function scheduleLinkedPageSchemaPreload(schema: PageSchemaType, currentRoute?: string) {
  const run = () => {
    void preloadLinkedPageSchemas(schema, currentRoute)
  }
  if (typeof window === 'undefined') {
    run()
    return
  }
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  }
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(run, { timeout: 1200 })
    return
  }
  window.setTimeout(run, 0)
}

function collectStaticLinkedPagePaths(layout: unknown): string[] {
  const paths: string[] = []

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return
    }

    const current = node as Record<string, any>
    const path = String(current.path || '').trim()
    if (isStaticLinkedPagePath(path) && current.meta?.preload !== false) {
      paths.push(path)
    }

    const children = current.children
    if (!children || typeof children !== 'object' || Array.isArray(children)) {
      return
    }

    Object.values(children).forEach(walk)
  }

  walk(layout)
  return Array.from(new Set(paths))
}

function isStaticLinkedPagePath(path: string) {
  return path.startsWith('/') && !path.startsWith('//')
}

function normalizeLinkedPageRouteKey(route?: string) {
  const value = String(route || '').trim()
  if (!value) {
    return ''
  }

  const [path, query = ''] = value.split('?')
  const normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, '')
  const normalizedQuery = new URLSearchParams(query).toString()
  return normalizedQuery ? `${normalizedPath}?${normalizedQuery}` : normalizedPath
}

/**
 * 内部组件：创建独立 store 并渲染布局
 */
function PageInner({
  schema,
  route,
  parentStore,
  onStoreReady,
  assistantScope,
  updateDocumentTitle,
}: {
  schema: PageSchemaType
  route?: string
  parentStore?: PageStore | null
  onStoreReady?: (store: PageStore | null) => void
  assistantScope?: AssistantPageScope
  updateDocumentTitle: boolean
}) {
  // 创建独立 store
  const pagePath = route ?? schema.page.route ?? ''
  const store = useMemo(
    () => createPageStore(schema, pagePath, parentStore ?? null),
    [pagePath, parentStore, schema]
  )

  // 执行 init actions
  const runInitActions = useCallback(async () => {
    if (schema.page.init?.length) {
      for (const actionName of schema.page.init) {
        await runAction(store, actionName)
      }
    }
  }, [schema, store])

  useEffect(() => {
    runInitActions()
  }, [runInitActions])

  useEffect(() => {
    onStoreReady?.(store)
    return () => {
      onStoreReady?.(null)
    }
  }, [onStoreReady, store])

  const assistantRegistrationIdRef = useRef('')
  if (!assistantRegistrationIdRef.current) {
    assistantRegistrationIdRef.current = createAssistantRegistrationID(pagePath, schema)
  }
  const assistantRegistrationId = assistantRegistrationIdRef.current

  useEffect(() => {
    return registerAssistantPage({
      id: assistantRegistrationId,
      store,
      route: pagePath,
      scope: assistantScope || (parentStore ? 'nested' : 'page'),
    })
  }, [assistantRegistrationId, assistantScope, pagePath, parentStore, store])

  // 设置页面标题
  useEffect(() => {
    if (!updateDocumentTitle) {
      return
    }

    document.title = formatDocumentTitle(schema.page.name || schema.page.title)
  }, [schema.page.name, schema.page.title, updateDocumentTitle])

  return (
    <PageStoreContext.Provider value={store}>
      <div
        className="contents"
        onFocusCapture={() => activateAssistantPage(assistantRegistrationId)}
        onPointerDownCapture={() => activateAssistantPage(assistantRegistrationId)}
      >
        <LayoutRenderer config={schema.layout} />
      </div>
    </PageStoreContext.Provider>
  )
}

function createAssistantRegistrationID(pagePath: string, schema: PageSchemaType) {
  const pageName = pagePath || schema.page.name || schema.page.title || 'page'
  return `assistant:${pageName}:${Math.random().toString(16).slice(2)}`
}
