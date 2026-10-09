/**
 * Feedback/Confirm.tsx - 确认弹窗
 * 使用 shadcn/ui AlertDialog
 */
import { useStore } from 'zustand'
import { useActionSubmission } from '@/hooks/use-action-submission'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { getByPath, setByPath } from '@/lib/path'
import { runActionsWithResult } from '@/lib/action'
import { toastActionResult } from '@/lib/action-toast'
import { reloadStorePageSchema } from '@/lib/page-schema-reload'
import type { NodeItemProps } from '../../nodes'

export function FeedbackConfirm({ item, store }: NodeItemProps) {
  const stateKey = item.meta?.stateKey || item.id
  const open = useStore(store, (s) => !!getByPath(s.state, stateKey))
  const actionContext = {
    item,
    itemKey: String(stateKey || '').replace(/\./g, '-'),
  }
  const { submitting, isSubmitting, run } = useActionSubmission(
    store, item.action?.confirm, actionContext, `confirm:${stateKey}`
  )

  const handleOpenChange = (val: boolean) => {
    if (isSubmitting()) {
      return
    }
    store.getState().setPageState(stateKey, val)
  }

  const handleConfirm = () => run(async (executionContext) => {
    if (item.action?.confirm) {
      const result = await runActionsWithResult(store, item.action.confirm, executionContext)
      if (result.ignored) return
      toastActionResult(result, buildConfirmToastOptions(item))
      if (!result.success) return
    }

    const patched = applyConfirmLocalPatch(store, item)
    if (!patched) await reloadStorePageSchema(store)

    store.getState().setPageState(stateKey, false)
  })

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{item.name || '确认'}</AlertDialogTitle>
          <AlertDialogDescription>
            {item.info || '确定要执行此操作吗？'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          <Button type="button" onClick={() => void handleConfirm()} disabled={submitting}>
            {submitting ? '处理中...' : '确定'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function buildConfirmToastOptions(item: NodeItemProps['item']) {
  return {
    successMessage: item.meta?.successMessage,
    errorMessage: item.meta?.errorMessage,
    defaultSuccessMessage: '操作成功',
    defaultErrorMessage: '操作失败',
  }
}

function applyConfirmLocalPatch(store: NodeItemProps['store'], item: NodeItemProps['item']) {
  const targetPath = String(item.meta?.patchTargetPath || '').trim()
  const payloadPath = String(item.meta?.patchPayloadPath || '').trim()
  const rowKey = String(item.meta?.patchRowKey || 'id').trim() || 'id'

  if (!targetPath || !payloadPath) {
    return false
  }

  const payload = store.getState().getValueByPath(payloadPath)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false
  }

  const currentRows = store.getState().getValueByPath(targetPath)
  if (!Array.isArray(currentRows)) {
    return false
  }

  const currentRowID = getByPath(payload, rowKey)
  const patchEntries = Object.entries(payload as Record<string, any>).filter(([field]) => {
    if (field === '_partial') {
      return false
    }
    return field !== rowKey && String(field).trim() !== ''
  })
  if (patchEntries.length === 0) {
    return false
  }

  const nextRows = currentRows.map((currentRow) => {
    if (String(getByPath(currentRow, rowKey) ?? '') !== String(currentRowID ?? '')) {
      return currentRow
    }

    return patchEntries.reduce(
      (resultRow, [field, value]) => setByPath(resultRow, field, value),
      currentRow
    )
  })

  store.getState().setValueByPath(targetPath, nextRows)
  return true
}
