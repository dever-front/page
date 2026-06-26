/**
 * Show/Button.tsx - 按钮节点
 * 支持 to + open 语义：
 * - open=path(default): 直接跳页面
 * - open=modal: 弹窗打开页面
 * - confirm: 统一确认弹窗
 * - successMessage: 操作成功提示
 * - loadingText: 请求中按钮文案
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { runActionsWithResult } from '@/lib/action'
import {
  buildRemoteSearchPatch,
  buildRemoteSearchResetPatch,
  isManualRemoteSearchLayout,
  normalizeRemoteSearchValue,
  resetRemoteSearchValues,
} from '@/lib/remote-search'
import { normalizeDataContainerKey, reloadStoreDataContainer } from '@/lib/page-data-reload'
import {
  buildStoreBackNavigationHref,
  getNavigationBackTarget,
  parseInternalNavigationHref,
  withBackNavigationSearch,
} from '@/lib/navigation'
import {
  getCurrentRouterPathname,
  stripRouterBasePath,
} from '@/lib/router-path'
import { resolveLucideIcon } from '@/lib/icon'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

type ButtonConfirmMeta = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

export function ShowButton({ item, value, store, layoutId }: NodeItemProps) {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fallbackBackTarget = parseInternalNavigationHref(item.meta?.fallback ?? item.meta?.to)
  const backTarget = item.meta?.back === true ? getNavigationBackTarget() : null

  const confirmMeta =
    item.meta?.confirm === true
      ? {}
      : item.meta?.confirm && typeof item.meta.confirm === 'object'
        ? (item.meta.confirm as ButtonConfirmMeta)
        : null

  const runCurrentAction = async () => {
    if (item.meta?.validateForm === true && !store.getState().validateForm()) {
      return false
    }

    if (item.meta?.back === true) {
      const target = backTarget ?? fallbackBackTarget
      if (target) {
        navigate({ to: target.to, search: target.search })
      }
      return true
    }

    if (item.meta?.searchSubmit === true) {
      const searchPatch = buildRemoteSearchPatch(
        store.getState(),
        String(item.meta?.searchLayoutId || layoutId || '').trim()
      )
      const reloadKey = resolveReloadDataKey(item.meta)
      applySearchPatchToStore(store, searchPatch, reloadKey)
      await reloadStoreDataContainer(store, reloadKey)
      return true
    }

    if (item.meta?.to) {
      const openMode = item.meta?.open || 'path'
      const searchLayoutId = String(item.meta?.searchLayoutId || layoutId || '').trim()
      const targetPath = stripRouterBasePath(item.meta.to)

      if (openMode === 'modal') {
        const stateKey = item.meta?.stateKey || 'dialog.open'
        const routeKey = item.meta?.routeKey || 'dialog.route'
        store.getState().setPageState(routeKey, targetPath)
        store.getState().setPageState(stateKey, true)
        return true
      }

      if (openMode === 'drawer') {
        const stateKey = item.meta?.stateKey || 'drawer.open'
        const routeKey = item.meta?.routeKey || 'drawer.route'
        store.getState().setPageState(routeKey, targetPath)
        store.getState().setPageState(stateKey, true)
        return true
      }

      if (
        targetPath === getCurrentRouterPathname() &&
        isManualRemoteSearchLayout(store.getState().schema, searchLayoutId)
      ) {
        const resetPatch = buildRemoteSearchResetPatch(store.getState().schema, searchLayoutId)
        const reloadKey = resolveReloadDataKey(item.meta)
        resetRemoteSearchValues(store, searchLayoutId)
        applySearchPatchToStore(store, { page: undefined }, reloadKey)
        if (await reloadStoreDataContainer(store, reloadKey)) {
          return true
        }

        navigate({
          to: targetPath,
          search: resetPatch,
        })
        return true
      }

      const search = withBackNavigationSearch(undefined, item.meta?.withBack, {
        from: buildStoreBackNavigationHref(store),
      })
      navigate({ to: targetPath, search })
      return true
    }

    if (item.action?.click) {
      const result = await runActionsWithResult(store, item.action.click)
      return result.success
    }

    return true
  }

  if (item.meta?.back === true && !backTarget && !fallbackBackTarget) {
    return null
  }

  const Icon = resolveLucideIcon(item.icon || item.meta?.icon)
  const buttonLabel = submitting
    ? item.meta?.loadingText || '处理中...'
    : item.name || value || ''

  const executeAction = async () => {
    if (submitting) {
      return
    }

    setSubmitting(true)
    try {
      const success = await runCurrentAction()
      if (!success) {
        return
      }

      if (confirmOpen) {
        setConfirmOpen(false)
      }

      const successMessage = String(item.meta?.successMessage || '').trim()
      if (successMessage) {
        toast.success(successMessage)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClick = async () => {
    if (submitting) {
      return
    }

    if (confirmMeta) {
      setConfirmOpen(true)
      return
    }

    await executeAction()
  }

  return (
    <>
      <Button
        type="button"
        variant={item.meta?.variant || 'default'}
        size={item.meta?.size || 'sm'}
        className={cn(item.className)}
        onClick={() => void handleClick()}
        disabled={submitting || !!item.meta?.disabled}
      >
        {Icon && !submitting ? <Icon className="size-4" /> : null}
        {buttonLabel ? <span>{buttonLabel}</span> : null}
      </Button>

      {confirmMeta ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (submitting) {
              return
            }
            setConfirmOpen(open)
          }}
          title={confirmMeta.title || item.name || '确认操作'}
          desc={confirmMeta.description || item.info || '确定要执行此操作吗？'}
          confirmText={
            submitting
              ? item.meta?.loadingText || '处理中...'
              : confirmMeta.confirmText || '确定'
          }
          cancelBtnText={confirmMeta.cancelText || '取消'}
          destructive={confirmMeta.destructive}
          isLoading={submitting}
          handleConfirm={() => void executeAction()}
        />
      ) : null}
    </>
  )
}

function resolveReloadDataKey(meta: Record<string, any> | undefined) {
  return normalizeDataContainerKey(String(meta?.reloadDataKey || meta?.reloadKey || 'table'))
}

function applySearchPatchToStore(
  store: NodeItemProps['store'],
  patch: Record<string, unknown>,
  reloadKey: string
) {
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'page') {
      store.getState().setValueByPath(`data.${reloadKey}.page`, 1)
      continue
    }
    if (key === 'pageSize') {
      store.getState().setValueByPath(`data.${reloadKey}.pageSize`, value)
      continue
    }

    const normalized = normalizeRemoteSearchValue(value)
    store.getState().setValueByPath(`data.search.${key}`, normalized ?? '')
  }
}
