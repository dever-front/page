/**
 * Feedback/Modal.tsx - 弹窗
 * 使用 shadcn/ui Dialog
 * meta.formSection: layout section ID → 渲染 NodeList
 * meta.content: HTML 字符串（回退）
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useStore } from 'zustand'
import { Copy, Square } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getByPath, resolvePath } from '@/lib/path'
import { loadPageSchema } from '@/lib/request'
import { reloadStorePageSchema } from '@/lib/page-schema-reload'
import { validatePageSchema, type PageSchemaType } from '@/lib/schema'
import { useAssistantOverlayRegistration } from '@/lib/assistant/use-overlay-registration'
import { setAssistantFloatingBlockedByModal } from '@/lib/assistant/floating-state'
import { AssistantFormFillButton } from '@/components/assistant/form-actions'
import {
  type ActionRunResult,
  runActionWithResult as runStoreActionWithResult,
  runActionsWithResult,
} from '@/lib/action'
import type { PageStore } from '@/lib/store'
import { applyPageSchemaPatches, buildPageRouteWithQuery } from './shared/page-patch'
import { Page } from '../../page'
import { NodeList } from '../../nodes'
import type { NodeItemProps } from '../../nodes'
import { ShowButton } from '../show/button'

const OVERLAY_CONTENT_CLEANUP_DELAY = 220

const MODAL_SIZE_CLASS_MAP: Record<string, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
}

function resolveDialogWidthClass(meta: Record<string, any> | undefined) {
  const configuredSize = String(meta?.size || '').trim().toLowerCase()
  if (configuredSize && MODAL_SIZE_CLASS_MAP[configuredSize]) {
    return MODAL_SIZE_CLASS_MAP[configuredSize]
  }

  return MODAL_SIZE_CLASS_MAP.lg
}

function resolveDialogOverflowClass(meta: Record<string, any> | undefined) {
  return meta?.contentOverflow === 'hidden' ? 'overflow-hidden' : 'overflow-visible'
}

function resolveDialogBodyOverflowClass(meta: Record<string, any> | undefined) {
  return meta?.bodyScroll === false ? 'overflow-hidden' : 'overflow-y-auto'
}

export function FeedbackModal({ item, store }: NodeItemProps) {
  // 从 state 读取开关状态
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
  const assistantFloatingBlockIdRef = useRef(
    `feedback-modal:${item.id}:${Math.random().toString(36).slice(2)}`
  )
  const formId = useMemo(() => `modal-form-${item.id}`, [item.id])
  const footer = item.meta?.footer ?? {}
  const showConfirm = !!footer.confirm
  const showClose = ![false, 'false', 0, '0'].includes(footer.close)
  const footerButtons = Array.isArray(footer.buttons) ? footer.buttons : []
  const titleFromPath = useStore(store, (s) =>
    readMetaPathValue(s, item.meta?.titlePath)
  )
  const titleNameFromPath = useStore(store, (s) =>
    readMetaPathValue(s, item.meta?.titleNamePath)
  )
  const titleKeyFromPath = useStore(store, (s) =>
    readMetaPathValue(s, item.meta?.titleKeyPath)
  )
  const descriptionFromPath = useStore(store, (s) =>
    readMetaPathValue(s, item.meta?.descriptionPath)
  )
  const baseTitle =
    titleFromPath || item.meta?.title || item.name || pageSchema?.page?.title || '弹窗'
  const title = titleNameFromPath
    ? `${baseTitle}：${titleNameFromPath}${titleKeyFromPath ? `(${titleKeyFromPath})` : ''}`
    : baseTitle
  const description = descriptionFromPath || item.meta?.description || item.info
  const assistantEnabled = item.meta?.assistant !== false
  const assistantFormStore = assistantEnabled
    ? pageStore ?? (item.meta?.formSection ? store : null)
    : null
  const assistantOverlayStore = assistantFormStore ?? store
  const [hotVersion, setHotVersion] = useState(0)
  const [maximized, setMaximized] = useState(false)
  const activateAssistantOverlay = useAssistantOverlayRegistration({
    open,
    store: assistantOverlayStore,
    scope: 'modal',
    route: String(pageRoute || ''),
    name: String(item.id || item.name || 'modal'),
  })
  const widthStyle = item.meta?.width
    ? {
        width: `min(calc(100vw - 2rem), ${String(item.meta.width)})`,
        maxWidth: `min(calc(100vw - 2rem), ${String(item.meta.width)})`,
      }
    : undefined
  const dialogWidthClass = resolveDialogWidthClass(item.meta)
  const maximizable = ![false, 'false', 0, '0'].includes(item.meta?.maximizable)

  useEffect(() => {
    const blockId = assistantFloatingBlockIdRef.current
    setAssistantFloatingBlockedByModal(blockId, open && maximized)
    return () => setAssistantFloatingBlockedByModal(blockId, false)
  }, [maximized, open])

  const handleOpenChange = (val: boolean) => {
    store.getState().setPageState(stateKey, val)
  }

  useEffect(() => {
    let cancelled = false

    async function loadModalPage() {
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

    loadModalPage()
    return () => {
      cancelled = true
    }
  }, [item.meta, open, pageRoute, store])

  useEffect(() => {
    if (open) {
      return
    }

    setMaximized(false)

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
        return file.includes('/src/page/nodes/feedback/modal.tsx')
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
    event.stopPropagation()

    if (pageStore && !pageStore.getState().validateForm()) {
      return
    }

    if (!pageStore && !store.getState().validateForm()) {
      return
    }

    const closeOverlayAndRefreshParent = async (submitResult?: ActionRunResult) => {
      if (item.action?.success) {
        const result = await runActionsWithResult(store, item.action.success, {
          modalStore: pageStore,
          modalData: pageStore?.getState().data,
          modalState: pageStore?.getState().state,
          modalForm: pageStore?.getState().data?.form,
          result: submitResult?.data,
          message: submitResult?.message,
        })
        if (!result.success) {
          return
        }
      }

      refreshParentOnCloseRef.current = item.meta?.refreshParentOnSuccess !== false
      handleOpenChange(false)
    }

    if (item.action?.submit) {
      const result = await runActionsWithResult(store, item.action.submit, {
        modalStore: pageStore,
        modalData: pageStore?.getState().data,
        modalState: pageStore?.getState().state,
        modalForm: pageStore?.getState().data?.form,
      })
      if (result.success) {
        await closeOverlayAndRefreshParent(result)
      }
      return
    }

    if (pageStore?.getState().action.submit) {
      const result = await runStoreActionWithResult(pageStore, 'submit')
      if (result.success) {
        await closeOverlayAndRefreshParent(result)
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
          assistantScope="modal"
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        key={hotVersion}
        showCloseButton={false}
        style={maximized ? undefined : widthStyle}
        onFocusCapture={activateAssistantOverlay}
        onPointerDownCapture={activateAssistantOverlay}
        className={cn(
          'flex flex-col gap-0 p-0',
          maximized
            ? 'h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)]'
            : ['max-h-[85vh]', dialogWidthClass],
          resolveDialogOverflowClass(item.meta),
        )}
      >
        {loadingPage && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-[inherit] bg-border/30">
            <div className="dialog-loading-bar h-full w-1/3 rounded-full bg-primary/85" />
          </div>
        )}
        <DialogHeader className="shrink-0 px-6 py-4 text-start">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className={description ? undefined : 'sr-only'}>
                {description || `${title}弹窗，请在弹窗内完成操作。`}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              {assistantFormStore ? (
                <AssistantFormFillButton
                  store={assistantFormStore}
                  scope="modal"
                  route={String(pageRoute || '')}
                  className="-mt-2 size-8 shrink-0 self-start"
                  variant="ghost"
                  size="icon"
                  iconOnly
                  overwrite
                />
              ) : null}
              {maximizable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={maximized ? '还原' : '最大化'}
                  className="-mt-2 size-8 shrink-0 self-start"
                  onClick={() => setMaximized((value) => !value)}
                >
                  <span className="sr-only">{maximized ? '还原' : '最大化'}</span>
                  {maximized ? (
                    <Copy className="size-4" />
                  ) : (
                    <Square className="size-4" />
                  )}
                </Button>
              ) : null}
              <DialogClose asChild>
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
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'min-h-0 flex-1 px-6 py-4',
              resolveDialogBodyOverflowClass(item.meta),
              item.meta?.bodyClassName
            )}
          >
            {renderBodyContent()}
          </div>

          {(showClose || showConfirm || footerButtons.length > 0) && (
            <DialogFooter className="shrink-0 px-6 py-4">
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
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
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
  if (value == null) {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}
