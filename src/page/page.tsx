/**
 * Page.tsx - 页面入口与运行时装载
 * 根据 route 或 schema 获取页面 JSON
 * 创建独立 store，初始化数据，执行 init actions
 * 渲染根布局
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { getSiteConfig } from '@/config/app-config'
import { runAction } from '@/lib/action'
import {
  activateAssistantPage,
  registerAssistantPage,
  type AssistantPageScope,
} from '@/lib/assistant/registry'
import { finishPageProgress, startPageProgress } from '@/lib/page-progress'
import {
  finishPageReload,
  isSamePageReloadRoute,
  PAGE_RELOAD_EVENT,
  type PageReloadDetail,
} from '@/lib/page-reload'
import { loadPageSchema } from '@/lib/request'
import {
  getActiveRouteNavigationKey,
  getCurrentRouteNavigationKey,
  normalizeRouteKey,
} from '@/lib/route-key'
import { validatePageSchema, type PageSchemaType } from '@/lib/schema'
import { createPageStore, PageStoreContext, type PageStore } from '@/lib/store'
import { LayoutRenderer } from './layout'

type PageProps = {
  route?: string
  schema?: any
  parentStore?: PageStore | null
  onStoreReady?: (store: PageStore | null) => void
  onReady?: () => void
  assistantScope?: AssistantPageScope
  updateDocumentTitle?: boolean
}

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
    const page =
      schema?.page && typeof schema.page === 'object' ? schema.page : {}
    return `schema:${page.route || page.id || page.name || page.title || 'inline'}`
  }

  return `route:${String(route || '').trim()}`
}

export function Page({
  route,
  schema: schemaProp,
  parentStore,
  onStoreReady,
  onReady,
  assistantScope,
  updateDocumentTitle = true,
}: PageProps) {
  const [pageSchema, setPageSchema] = useState<PageSchemaType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadedKey, setLoadedKey] = useState('')
  const [reloadVersion, setReloadVersion] = useState(0)
  const loadKey = buildPageLoadKey(route, schemaProp)
  const hasLoadedRef = useRef(false)
  const loadedKeyRef = useRef('')

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
      const currentBrowserRouteKey =
        currentBrowserNavigationKey.split('@')[0] || ''
      const activeNavigationKey = getActiveRouteNavigationKey()
      const progressRequestKey =
        reloadVersion > 0
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
        if (cancelled) return
        setPageSchema(validated)
        loadedKeyRef.current = loadKey
        setLoadedKey(loadKey)
        hasLoadedRef.current = true
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
    return () => {
      cancelled = true
    }
  }, [loadKey, reloadVersion, route, schemaProp])

  useEffect(() => {
    if (error) {
      onReady?.()
    }
  }, [error, onReady])

  const isStalePage = loadedKey !== loadKey

  if (error) {
    return (
      <div className='flex h-full items-center justify-center p-8'>
        <div className='text-destructive'>{error}</div>
      </div>
    )
  }

  if (loading || isStalePage) {
    return (
      <div className='flex h-full items-center justify-center p-8'>
        <div className='text-muted-foreground'>加载中...</div>
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
      onReady={onReady}
      assistantScope={assistantScope}
      updateDocumentTitle={updateDocumentTitle}
    />
  )
}

/**
 * 内部组件：创建独立 store 并渲染布局
 */
function PageInner({
  schema,
  route,
  parentStore,
  onStoreReady,
  onReady,
  assistantScope,
  updateDocumentTitle,
}: {
  schema: PageSchemaType
  route?: string
  parentStore?: PageStore | null
  onStoreReady?: (store: PageStore | null) => void
  onReady?: () => void
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

  useEffect(() => {
    onReady?.()
  }, [onReady])

  const assistantRegistrationIdRef = useRef('')
  if (!assistantRegistrationIdRef.current) {
    assistantRegistrationIdRef.current = createAssistantRegistrationID(
      pagePath,
      schema
    )
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
        className='contents'
        onFocusCapture={() => activateAssistantPage(assistantRegistrationId)}
        onPointerDownCapture={() =>
          activateAssistantPage(assistantRegistrationId)
        }
      >
        <LayoutRenderer config={schema.layout} />
      </div>
    </PageStoreContext.Provider>
  )
}

function createAssistantRegistrationID(
  pagePath: string,
  schema: PageSchemaType
) {
  const pageName = pagePath || schema.page.name || schema.page.title || 'page'
  return `assistant:${pageName}:${Math.random().toString(16).slice(2)}`
}
