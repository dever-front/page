import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ImportDialog } from '@/components/import/import-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { runActionsWithResult, type ImportActionPayload } from '@/lib/action'
import type { ExportTaskInfo } from '@/lib/export-task'
import { downloadExportTask, getExportTaskInfo } from '@/lib/export-task'
import { resolveLucideIcon } from '@/lib/icon'
import { hasAuth } from '@/lib/permission'
import { canUseItem } from '@/lib/permission-infer'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import type { NodeItemProps } from '../../nodes'

export function ShowButtonGroup({ item, store }: NodeItemProps) {
  const authList = useAuthStore((state) => state.auth.authList)
  const authRules = useAuthStore((state) => state.auth.authRules)
  const groupAllowed = hasAuth(item.auth, authList)
  const menuItems = useMemo(
    () =>
      normalizeButtonGroupItems(item.items).filter((menuItem, index) => {
        const itemKey = resolveButtonGroupItemKey(item, menuItem, index)
        return canUseItem(
          store.getState(),
          menuItem,
          { item: menuItem, itemKey, group: item },
          authList,
          authRules
        )
      }),
    [authList, authRules, item, store]
  )
  const TriggerIcon = resolveLucideIcon(String(item.meta?.icon || item.icon || '').trim())
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [loadingKey, setLoadingKey] = useState('')
  const [task, setTask] = useState<ExportTaskInfo | null>(null)
  const [importPayload, setImportPayload] = useState<ImportActionPayload | null>(null)
  const [importTitle, setImportTitle] = useState('')
  const [importDescription, setImportDescription] = useState('')
  const downloadedTaskIDRef = useRef(0)

  useEffect(() => {
    if (!exportDialogOpen || !task || !['pending', 'running'].includes(task.status)) {
      return
    }

    let canceled = false
    const timer = window.setInterval(async () => {
      try {
        const nextTask = await getExportTaskInfo(task.id)
        if (canceled) {
          return
        }

        setTask(nextTask)
        if (nextTask.status === 'success') {
          window.clearInterval(timer)
          if (downloadedTaskIDRef.current !== nextTask.id) {
            downloadedTaskIDRef.current = nextTask.id
            await downloadExportTask(nextTask)
            toast.success('导出完成')
          }
          setExportDialogOpen(false)
          return
        }

        if (nextTask.status === 'failed') {
          window.clearInterval(timer)
        }
      } catch (error: any) {
        if (canceled) {
          return
        }
        window.clearInterval(timer)
        setTask((prev) =>
          prev
            ? {
                ...prev,
                status: 'failed',
                error_message: error?.message || '导出任务轮询失败',
              }
            : null
        )
      }
    }, 1000)

    return () => {
      canceled = true
      window.clearInterval(timer)
    }
  }, [exportDialogOpen, task])

  if (!groupAllowed || menuItems.length === 0) {
    return null
  }

  const handleItemClick = async (menuItem: Record<string, any>, index: number) => {
    if (loadingKey) {
      return
    }

    if (!menuItem.action?.click) {
      return
    }

    const itemKey = resolveButtonGroupItemKey(item, menuItem, index)
    setLoadingKey(itemKey)
    try {
      const result = await runActionsWithResult(store, menuItem.action?.click, {
        item: menuItem,
        itemKey,
        group: item,
      })

      if (!result.success) {
        toast.error(result.message || '操作失败')
        return
      }

      if (isExportTaskInfo(result.data)) {
        downloadedTaskIDRef.current = 0
        setTask(result.data)
        setExportDialogOpen(true)
        return
      }

      if (isImportActionPayload(result.data)) {
        setImportPayload(result.data)
        setImportTitle(menuItem.name || item.name || '导入')
        setImportDescription(menuItem.info || item.info || '')
        setImportDialogOpen(true)
      }
    } finally {
      setLoadingKey('')
    }
  }

  const progressValue = Math.max(0, Math.min(Number(task?.progress || 0), 100))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={item.meta?.variant || 'outline'}
            size={item.meta?.size || 'sm'}
            className={cn(item.className)}
            disabled={!!item.meta?.disabled || !!loadingKey}
          >
            {loadingKey ? <LoaderCircle className="size-4 animate-spin" /> : TriggerIcon ? <TriggerIcon className="size-4" /> : null}
            {item.name || '按钮组'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {menuItems.map((menuItem, index) => {
            const MenuIcon = resolveLucideIcon(String(menuItem.icon || menuItem.meta?.icon || '').trim())
            const itemKey = resolveButtonGroupItemKey(item, menuItem, index)

            return (
              <DropdownMenuItem
                key={itemKey}
                onClick={() => void handleItemClick(menuItem, index)}
                disabled={!!loadingKey || !!menuItem.meta?.disabled}
              >
                {MenuIcon ? <MenuIcon className="mr-2 size-4" /> : null}
                {menuItem.name || itemKey}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>导出进度</DialogTitle>
            <DialogDescription>
              {task?.status === 'failed'
                ? task.error_message || '导出失败'
                : task?.stage || '正在准备导出任务'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressValue}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{task?.stage || '等待开始'}</span>
              <span>{progressValue}%</span>
            </div>

            {task?.status === 'failed' ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {task.error_message || '导出失败'}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importDialogOpen}
        title={importTitle}
        description={importDescription}
        payload={importPayload}
        store={store}
        onOpenChange={(nextOpen) => {
          setImportDialogOpen(nextOpen)
          if (!nextOpen) {
            setImportPayload(null)
            setImportDescription('')
          }
        }}
      />
    </>
  )
}

function normalizeButtonGroupItems(raw: unknown) {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((item): item is Record<string, any> => !!item && typeof item === 'object')
}

function resolveButtonGroupItemKey(
  groupItem: Record<string, any>,
  menuItem: Record<string, any>,
  index: number
) {
  const actionKey = String(
    menuItem.action?.click?.exportKey || menuItem.action?.click?.importKey || ''
  ).trim()
  if (actionKey) {
    return actionKey
  }

  const configuredKey = String(menuItem.key || menuItem.id || '').trim()
  if (configuredKey) {
    return configuredKey
  }

  const groupKey = String(groupItem.id || groupItem.key || '').trim()
  if (groupKey) {
    return `${groupKey}_${index + 1}`
  }

  return `button_group_${index + 1}`
}

function isExportTaskInfo(value: any): value is ExportTaskInfo {
  return !!value && typeof value === 'object' && Number(value.id) > 0 && typeof value.status === 'string'
}

function isImportActionPayload(value: any): value is ImportActionPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    value.kind === 'import' &&
    typeof value.path === 'string' &&
    typeof value.importKey === 'string'
  )
}
