import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  archiveAssistantSession,
  listAssistantSessions,
  renameAssistantSession,
  restoreAssistantSession,
  type AssistantSessionListPayload,
  type AssistantSessionRecord,
  type AssistantSessionStatus,
} from '@/lib/assistant/session'

export type AssistantSessionHistoryQuery = {
  page: number
  pageSize: number
  keyword: string
  status: AssistantSessionStatus
}

export type AssistantSessionHistoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentKey: string
  contextKey: string
  activeSessionID?: number
  disabled?: boolean
  assistantLayer?: boolean
  layerClassName?: string
  layerZIndex?: number
  title?: string
  description?: string
  pageSize?: number
  loadSessions?: (
    query: AssistantSessionHistoryQuery
  ) => Promise<AssistantSessionListPayload>
  onOpenSession: (sessionID: number) => void | Promise<void>
  onArchiveSession?: (sessionID: number) => void | Promise<void>
  onRestoreSession?: (sessionID: number) => void | Promise<void>
  onRenameSession?: (
    sessionID: number,
    title: string
  ) => void | Promise<AssistantSessionRecord | null | undefined>
}

const statusOptions: Array<{
  value: AssistantSessionStatus
  label: string
}> = [
  { value: 'active', label: '活跃' },
  { value: 'archived', label: '已归档' },
  { value: 'all', label: '全部' },
]

export function AssistantSessionHistoryDialog({
  open,
  onOpenChange,
  agentKey,
  contextKey,
  activeSessionID = 0,
  disabled = false,
  assistantLayer = false,
  layerClassName,
  layerZIndex,
  title = '历史会话',
  description = '当前场景下的会话记录，可切换后继续对话。',
  pageSize = 10,
  loadSessions,
  onOpenSession,
  onArchiveSession,
  onRestoreSession,
  onRenameSession,
}: AssistantSessionHistoryDialogProps) {
  const [sessions, setSessions] = useState<AssistantSessionRecord[]>([])
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState<AssistantSessionStatus>('active')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionID, setActionID] = useState(0)
  const [editingID, setEditingID] = useState(0)
  const [editingTitle, setEditingTitle] = useState('')
  const [error, setError] = useState('')

  const canQuery = open && agentKey.trim() !== ''

  const query = useMemo<AssistantSessionHistoryQuery>(
    () => ({
      page,
      pageSize,
      keyword,
      status,
    }),
    [keyword, page, pageSize, status]
  )

  const fetchSessions = useCallback(async () => {
    if (!canQuery) {
      setSessions([])
      setTotal(0)
      setTotalPages(0)
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = loadSessions
        ? await loadSessions(query)
        : await listAssistantSessions({
            agentKey,
            contextKey,
            page: query.page,
            pageSize: query.pageSize,
            keyword: query.keyword,
            status: query.status,
          })
      setSessions(payload.sessions)
      setTotal(payload.pagination.total)
      setTotalPages(payload.pagination.total_pages)
      if (
        payload.pagination.total_pages > 0 &&
        query.page > payload.pagination.total_pages
      ) {
        setPage(payload.pagination.total_pages)
      }
    } catch (currentError) {
      setError(errorMessage(currentError, '加载会话列表失败'))
    } finally {
      setLoading(false)
    }
  }, [agentKey, canQuery, contextKey, loadSessions, query])

  useEffect(() => {
    if (!open) {
      return
    }
    void fetchSessions()
  }, [fetchSessions, open])

  useEffect(() => {
    if (!open) {
      return
    }
    const timer = window.setTimeout(() => {
      setPage(1)
      setKeyword(searchText.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [open, searchText])

  const openSession = async (sessionID: number) => {
    if (disabled || loading || actionID || !sessionID) {
      return
    }
    setActionID(sessionID)
    setError('')
    try {
      await onOpenSession(sessionID)
      onOpenChange(false)
    } catch (currentError) {
      setError(errorMessage(currentError, '打开会话失败'))
    } finally {
      setActionID(0)
    }
  }

  const updateSessionStatus = async (
    sessionID: number,
    nextStatus: AssistantSessionStatus
  ) => {
    if (disabled || loading || actionID || !sessionID) {
      return
    }
    setActionID(sessionID)
    setError('')
    try {
      if (nextStatus === 'archived') {
        if (onArchiveSession) {
          await onArchiveSession(sessionID)
        } else {
          await archiveAssistantSession(sessionID)
        }
      } else {
        if (onRestoreSession) {
          await onRestoreSession(sessionID)
        } else {
          await restoreAssistantSession(sessionID)
        }
      }
      await fetchSessions()
    } catch (currentError) {
      setError(errorMessage(currentError, '更新会话状态失败'))
    } finally {
      setActionID(0)
    }
  }

  const startRename = (session: AssistantSessionRecord) => {
    setEditingID(session.id)
    setEditingTitle(session.title || `会话 ${session.id}`)
  }

  const cancelRename = () => {
    setEditingID(0)
    setEditingTitle('')
  }

  const submitRename = async () => {
    const nextTitle = editingTitle.trim()
    if (!editingID || !nextTitle || disabled || actionID) {
      return
    }
    setActionID(editingID)
    setError('')
    try {
      const session = onRenameSession
        ? await onRenameSession(editingID, nextTitle)
        : await renameAssistantSession({
            sessionID: editingID,
            title: nextTitle,
          })
      if (session) {
        setSessions((current) =>
          current.map((item) => (item.id === session.id ? session : item))
        )
      } else {
        await fetchSessions()
      }
      cancelRename()
    } catch (currentError) {
      setError(errorMessage(currentError, '重命名会话失败'))
    } finally {
      setActionID(0)
    }
  }

  const currentPage = Math.max(1, page)
  const maxPage = Math.max(1, totalPages || 1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant-layer={assistantLayer ? 'true' : undefined}
        layerClassName={layerClassName}
        layerZIndex={layerZIndex}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                disabled={disabled || loading}
                placeholder="搜索会话标题"
                className="pl-9"
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
            <div className="flex shrink-0 rounded-md border bg-muted/20 p-1">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={status === option.value ? 'secondary' : 'ghost'}
                  className="h-8 px-3"
                  disabled={disabled || loading}
                  onClick={() => {
                    setStatus(option.value)
                    setPage(1)
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="min-h-80 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-dashed px-3 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载会话
              </div>
            ) : null}

            {!loading && sessions.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                暂无匹配的历史会话。
              </div>
            ) : null}

            {!loading
              ? sessions.map((session) => (
                  <SessionHistoryItem
                    key={session.id}
                    session={session}
                    active={session.id === activeSessionID}
                    disabled={disabled || Boolean(actionID)}
                    actionLoading={actionID === session.id}
                    editing={editingID === session.id}
                    editingTitle={editingTitle}
                    onEditingTitleChange={setEditingTitle}
                    onOpen={() => void openSession(session.id)}
                    onArchive={() =>
                      void updateSessionStatus(session.id, 'archived')
                    }
                    onRestore={() =>
                      void updateSessionStatus(session.id, 'active')
                    }
                    onStartRename={() => startRename(session)}
                    onSubmitRename={() => void submitRename()}
                    onCancelRename={cancelRename}
                  />
                ))
              : null}
          </div>

          <div className="flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              共 {total} 条，会话第 {currentPage} / {maxPage} 页
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || loading || currentPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="me-1 size-4" />
                上一页
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || loading || currentPage >= maxPage}
                onClick={() =>
                  setPage((current) => Math.min(maxPage, current + 1))
                }
              >
                下一页
                <ChevronRight className="ms-1 size-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SessionHistoryItem({
  session,
  active,
  disabled,
  actionLoading,
  editing,
  editingTitle,
  onEditingTitleChange,
  onOpen,
  onArchive,
  onRestore,
  onStartRename,
  onSubmitRename,
  onCancelRename,
}: {
  session: AssistantSessionRecord
  active: boolean
  disabled: boolean
  actionLoading: boolean
  editing: boolean
  editingTitle: string
  onEditingTitleChange: (value: string) => void
  onOpen: () => void
  onArchive: () => void
  onRestore: () => void
  onStartRename: () => void
  onSubmitRename: () => void
  onCancelRename: () => void
}) {
  const archived = session.status === 2

  return (
    <div
      className={cn(
        'rounded-md border bg-background px-3 py-2 transition-colors',
        active && 'border-primary/50 bg-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={editingTitle}
              autoFocus
              disabled={disabled || actionLoading}
              className="h-8"
              onChange={(event) => onEditingTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSubmitRename()
                }
                if (event.key === 'Escape') {
                  onCancelRename()
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="block w-full text-left disabled:cursor-default"
              disabled={disabled || active}
              onClick={onOpen}
            >
              <div className="truncate text-sm font-medium">
                {session.title || `会话 ${session.id}`}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{session.message_count || 0} 条消息</span>
                {session.last_message_at ? (
                  <span>{formatAssistantSessionTime(session.last_message_at)}</span>
                ) : null}
                {archived ? <span>已归档</span> : null}
              </div>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {actionLoading ? (
            <Loader2 className="mx-2 mt-1 size-4 animate-spin text-muted-foreground" />
          ) : editing ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={disabled || editingTitle.trim() === ''}
                onClick={onSubmitRename}
              >
                <Check className="size-4" />
                <span className="sr-only">保存标题</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={disabled}
                onClick={onCancelRename}
              >
                <X className="size-4" />
                <span className="sr-only">取消重命名</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={disabled}
                onClick={onStartRename}
              >
                <Edit2 className="size-4" />
                <span className="sr-only">重命名</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={disabled}
                onClick={archived ? onRestore : onArchive}
              >
                {archived ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
                <span className="sr-only">
                  {archived ? '取消归档' : '归档'}
                </span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function formatAssistantSessionTime(value?: string) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
