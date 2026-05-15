/**
 * Feedback/Drawer.tsx - 抽屉
 * 和 modal 共用同一套壳层语义：
 * 标题 / 右上关闭 / 中间内容滚动 / 底部按钮
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useStore } from 'zustand'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getByPath, resolvePath } from '@/lib/path'
import { loadPageSchema } from '@/lib/request'
import { reloadStorePageSchema } from '@/lib/page-schema-reload'
import { validatePageSchema, type PageSchemaType } from '@/lib/schema'
import { runActionWithResult as runStoreActionWithResult, runActionsWithResult } from '@/lib/action'
import { useAssistantOverlayRegistration } from '@/lib/assistant/use-overlay-registration'
import { AssistantFormFillButton } from '@/components/assistant/form-actions'
import type { PageStore } from '@/lib/store'
import { applyPageSchemaPatches, buildPageRouteWithQuery } from './shared/page-patch'
import { Page } from '../../page'
import { NodeList } from '../../nodes'
import type { NodeItemProps } from '../../nodes'
import { ShowButton } from '../show/button'

const OVERLAY_CONTENT_CLEANUP_DELAY = 220

export function FeedbackDrawer({ item, store }: NodeItemProps) {
  const stateKey = item.meta?.stateKey || item.id
  const open = useStore(store, (s) => !!getByPath(s.state, stateKey))
  const routeFromState = useStore(store, (s) =>
    item.meta?.pageRoutePath ? getByPath(s.state, item.meta.pageRoutePath) : undefined
  )
  const pageRoute = useMemo(
    () => buildPageRouteWithQuery(String(item.meta?.pageRoute || routeFromState || ''), store, item.meta),
    [item.meta, routeFromState, store, open]
  )
  const [pageSchema, setPageSchema] = useState<PageSchemaType | null>(null)
  const [pageStore, setPageStore] = useState<PageStore | null>(null)
  const [loadingPage, setLoadingPage] = useState(false)
  const refreshParentOnCloseRef = useRef(false)
  const [hotVersion, setHotVersion] = useState(0)
  const formId = useMemo(() => `drawer-form-${item.id}`, [item.id])
  const footer = item.meta?.footer ?? {}
  const showConfirm = !!footer.confirm
  const showClose = footer.close !== false
  const footerButtons = Array.isArray(footer.buttons) ? footer.buttons : []
  const titleFromPath = useStore(store, (s) =>
    readMetaPathValue(s, item.meta?.titlePath)
  )
  const descriptionFromPath = useStore(store, (s) =>
    readMetaPathValue(s, item.meta?.descriptionPath)
  )
  const title =
    titleFromPath || item.meta?.title || item.name || pageSchema?.page?.title || '详情'
  const description = descriptionFromPath || item.meta?.description || item.info
  const assistantFormStore = pageStore ?? (item.meta?.formSection ? store : null)
  const side = item.meta?.side || 'right'
  const activateAssistantOverlay = useAssistantOverlayRegistration({
    open,
    store,
    scope: 'drawer',
    route: String(pageRoute || ''),
    name: String(item.id || item.name || 'drawer'),
  })
  const widthStyle =
    item.meta?.width && (side === 'left' || side === 'right')
      ? {
          width: `min(100vw, ${String(item.meta.width)})`,
          maxWidth: `min(100vw, ${String(item.meta.width)})`,
        }
      : undefined

  const handleOpenChange = (val: boolean) => {
    store.getState().setPageState(stateKey, val)
  }

  useEffect(() => {
    let cancelled = false

    async function loadDrawerPage() {
      if (!open || !pageRoute) {
        setLoadingPage(false)
        return
      }

      setLoadingPage(true)
      setPageSchema(null)

      try {
        const raw = await loadPageSchema(String(pageRoute))
        if (!raw || cancelled) return

        const nextSchema = validatePageSchema(raw)
        const clonedSchema = applyPageSchemaPatches(nextSchema, store, item.meta)

        if (!cancelled) {
          setPageSchema(clonedSchema)
        }
      } finally {
        if (!cancelled) {
          setLoadingPage(false)
        }
      }
    }

    loadDrawerPage()
    return () => {
      cancelled = true
    }
  }, [item.meta, open, pageRoute, store])

  useEffect(() => {
    if (open) {
      return
    }

    const timer = window.setTimeout(() => {
      setPageSchema(null)
      setPageStore(null)

      if (refreshParentOnCloseRef.current) {
        refreshParentOnCloseRef.current = false
        void reloadStorePageSchema(store)
      }
    }, OVERLAY_CONTENT_CLEANUP_DELAY)

    return () => {
      window.clearTimeout(timer)
    }
  }, [open, store])

  useEffect(() => {
    if (!import.meta.env.DEV || !import.meta.hot) {
      return
    }

    const handleBeforeUpdate = (payload: {
      updates?: Array<{ path?: string; acceptedPath?: string }>
    }) => {
      const hit = payload.updates?.some((update) => {
        const file = update.acceptedPath ?? update.path ?? ''
        return file.includes('/src/page/nodes/feedback/drawer.tsx')
      })

      if (hit) {
        setHotVersion((version) => version + 1)
      }
    }

    import.meta.hot.on('vite:beforeUpdate', handleBeforeUpdate)
    return () => {
      import.meta.hot?.off('vite:beforeUpdate', handleBeforeUpdate)
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (pageStore && !pageStore.getState().validateForm()) {
      return
    }

    if (!pageStore && !store.getState().validateForm()) {
      return
    }

    const closeOverlayAndRefreshParent = () => {
      refreshParentOnCloseRef.current = true
      handleOpenChange(false)
    }

    if (item.action?.submit) {
      const result = await runActionsWithResult(store, item.action.submit)
      if (result.success) {
        closeOverlayAndRefreshParent()
      }
      return
    }

    if (pageStore?.getState().action.submit) {
      const result = await runStoreActionWithResult(pageStore, 'submit')
      if (result.success) {
        closeOverlayAndRefreshParent()
      }
      return
    }

    if (store.getState().action.submit) {
      await runStoreActionWithResult(store, 'submit')
    }
  }

  const renderBodyContent = () => {
    if (item.meta?.pageRoute || item.meta?.pageRoutePath) {
      return pageSchema ? (
        <Page
          route={String(pageRoute)}
          schema={pageSchema}
          parentStore={store}
          onStoreReady={setPageStore}
          assistantScope="drawer"
          updateDocumentTitle={false}
        />
      ) : null
    }

    if (item.meta?.formSection) {
      return <NodeList layoutId={item.meta.formSection} />
    }

    if (item.meta?.content) {
      return item.meta.content
    }

    return null
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        key={hotVersion}
        side={side}
        showCloseButton={false}
        style={widthStyle}
        onFocusCapture={activateAssistantOverlay}
        onPointerDownCapture={activateAssistantOverlay}
        className={cn(
          'flex h-full flex-col gap-0 overflow-visible p-0',
          side === 'left' || side === 'right' ? 'w-full sm:max-w-xl' : 'max-h-[85vh]',
          item.meta?.drawerClassName
        )}
      >
        {loadingPage && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-[inherit] bg-border/30">
            <div className="dialog-loading-bar h-full w-1/3 rounded-full bg-primary/85" />
          </div>
        )}
        <SheetHeader className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <SheetTitle>{title}</SheetTitle>
              {description && <SheetDescription>{description}</SheetDescription>}
            </div>
            <div className="flex shrink-0 items-start gap-2">
              {assistantFormStore ? (
                <AssistantFormFillButton
                  store={assistantFormStore}
                  scope="drawer"
                  route={String(pageRoute || '')}
                  className="mt-[-0.125rem]"
                  overwrite
                />
              ) : null}
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-mr-3 -mt-2 size-8 shrink-0 self-start"
                >
                  <span className="sr-only">关闭</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-6 py-4',
              item.meta?.bodyClassName
            )}
          >
            {renderBodyContent()}
          </div>

          {(showClose || showConfirm || footerButtons.length > 0) && (
            <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
              {footerButtons.map((buttonConfig: any, index: number) => (
                <ShowButton
                  key={buttonConfig.id ?? `${item.id}-footer-button-${index}`}
                  item={{
                    type: 'show-button',
                    ...buttonConfig,
                    id: buttonConfig.id ?? `${item.id}-footer-button-${index}`,
                  }}
                  value={buttonConfig.value}
                  setValue={() => {}}
                  option={undefined}
                  runAction={runAction}
                  store={store}
                  layoutId={layoutId}
                />
              ))}

              {showClose && (
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {footer.closeText || '关闭'}
                </Button>
              )}

              {showConfirm && (
                <Button type="submit" form={formId}>
                  {footer.confirmText || '确定'}
                </Button>
              )}
            </SheetFooter>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}

function readMetaPathValue(
  storeState: { data: Record<string, any>; state: Record<string, any> },
  path?: string
) {
  if (!path) {
    return ''
  }

  const { scope, key } = resolvePath(path)
  const source = scope === 'state' ? storeState.state : storeState.data
  const value = getByPath(source, key)
  return typeof value === 'string' ? value : ''
}
