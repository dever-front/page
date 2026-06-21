import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteAssistantMemory,
  listAssistantMemories,
  saveAssistantMemory,
  updateAssistantMemory,
  type AssistantMemoryKind,
  type AssistantMemoryListPayload,
  type AssistantMemoryRecord,
  type AssistantMemoryScope,
  type AssistantMemoryStatus,
} from '@/lib/assistant/session'

export type AssistantMemoryQuery = {
  page: number
  pageSize: number
  keyword: string
  kind: AssistantMemoryKind
  status: AssistantMemoryStatus
  scope: AssistantMemoryScope
}

export type AssistantMemoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentKey: string
  contextKey: string
  disabled?: boolean
  assistantLayer?: boolean
  layerClassName?: string
  layerZIndex?: number
  pageSize?: number
  loadMemories?: (
    query: AssistantMemoryQuery
  ) => Promise<AssistantMemoryListPayload>
  onChanged?: (memories: AssistantMemoryRecord[]) => void
}

const scopeOptions: Array<{ value: AssistantMemoryScope; label: string }> = [
  { value: 'current', label: '当前助理' },
  { value: 'global', label: '全局' },
  { value: 'all', label: '全部' },
]

const statusOptions: Array<{ value: AssistantMemoryStatus; label: string }> = [
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '停用' },
  { value: 'all', label: '全部' },
]

const kindOptions: Array<{ value: AssistantMemoryKind; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'persona', label: '偏好' },
  { value: 'procedural', label: '规则' },
  { value: 'semantic', label: '事实' },
  { value: 'episodic', label: '事件' },
  { value: 'content', label: '内容' },
  { value: 'working', label: '工作' },
]

const emptyDraft = {
  title: '',
  content: '',
  kind: 'semantic' as AssistantMemoryKind,
}

export function AssistantMemoryDialog({
  open,
  onOpenChange,
  agentKey,
  contextKey,
  disabled = false,
  assistantLayer = false,
  layerClassName,
  layerZIndex,
  pageSize = 8,
  loadMemories,
  onChanged,
}: AssistantMemoryDialogProps) {
  const [memories, setMemories] = useState<AssistantMemoryRecord[]>([])
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [searchText, setSearchText] = useState('')
  const [kind, setKind] = useState<AssistantMemoryKind>('')
  const [status, setStatus] = useState<AssistantMemoryStatus>('active')
  const [scope, setScope] = useState<AssistantMemoryScope>('current')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionID, setActionID] = useState(0)
  const [editingID, setEditingID] = useState(0)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [editingKind, setEditingKind] = useState<AssistantMemoryKind>('semantic')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')

  const canQuery = open && agentKey.trim() !== ''

  const query = useMemo<AssistantMemoryQuery>(
    () => ({
      page,
      pageSize,
      keyword,
      kind,
      status,
      scope,
    }),
    [kind, keyword, page, pageSize, scope, status]
  )

  const setMemoryRows = useCallback(
    (rows: AssistantMemoryRecord[]) => {
      setMemories(rows)
      onChanged?.(rows)
    },
    [onChanged]
  )

  const fetchMemories = useCallback(async () => {
    if (!canQuery) {
      setMemoryRows([])
      setTotal(0)
      setTotalPages(0)
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = loadMemories
        ? await loadMemories(query)
        : await listAssistantMemories({
            agentKey,
            contextKey,
            page: query.page,
            pageSize: query.pageSize,
            keyword: query.keyword,
            kind: query.kind,
            status: query.status,
            scope: query.scope,
          })
      setMemoryRows(payload.memories)
      setTotal(payload.pagination.total)
      setTotalPages(payload.pagination.total_pages)
      if (
        payload.pagination.total_pages > 0 &&
        query.page > payload.pagination.total_pages
      ) {
        setPage(payload.pagination.total_pages)
      }
    } catch (currentError) {
      setError(errorMessage(currentError, '加载记忆失败'))
    } finally {
      setLoading(false)
    }
  }, [agentKey, canQuery, contextKey, loadMemories, query, setMemoryRows])

  useEffect(() => {
    if (!open) {
      return
    }
    void fetchMemories()
  }, [fetchMemories, open])

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

  const resetDraft = () => {
    setCreating(false)
    setDraft(emptyDraft)
  }

  const submitDraft = async () => {
    const title = draft.title.trim()
    const content = draft.content.trim()
    if (!title || !content || disabled || actionID) {
      return
    }
    setActionID(-1)
    setError('')
    try {
      await saveAssistantMemory({
        agentKey,
        contextKey,
        title,
        content,
        kind: draft.kind || 'semantic',
        tags: [],
        importance: 70,
        scope: scope === 'global' ? 'global' : 'context',
      })
      resetDraft()
      await fetchMemories()
    } catch (currentError) {
      setError(errorMessage(currentError, '保存记忆失败'))
    } finally {
      setActionID(0)
    }
  }

  const startEdit = (memory: AssistantMemoryRecord) => {
    setEditingID(memory.id)
    setEditingTitle(memory.title)
    setEditingContent(memory.content)
    setEditingKind((memory.kind || 'semantic') as AssistantMemoryKind)
  }

  const cancelEdit = () => {
    setEditingID(0)
    setEditingTitle('')
    setEditingContent('')
    setEditingKind('semantic')
  }

  const submitEdit = async () => {
    const title = editingTitle.trim()
    const content = editingContent.trim()
    if (!editingID || !title || !content || disabled || actionID) {
      return
    }
    setActionID(editingID)
    setError('')
    try {
      const memory = await updateAssistantMemory({
        id: editingID,
        agentKey,
        contextKey,
        title,
        content,
        kind: editingKind || 'semantic',
      })
      if (memory) {
        setMemoryRows(
          memories.map((current) =>
            current.id === memory.id ? memory : current
          )
        )
      } else {
        await fetchMemories()
      }
      cancelEdit()
    } catch (currentError) {
      setError(errorMessage(currentError, '更新记忆失败'))
    } finally {
      setActionID(0)
    }
  }

  const removeMemory = async (memoryID: number) => {
    if (!memoryID || disabled || actionID) {
      return
    }
    setActionID(memoryID)
    setError('')
    try {
      await deleteAssistantMemory(memoryID)
      await fetchMemories()
    } catch (currentError) {
      setError(errorMessage(currentError, '删除记忆失败'))
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
        className="max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>长期记忆</DialogTitle>
          <DialogDescription>
            自动保存稳定偏好、项目约束和常用规则；敏感信息不会进入长期记忆。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                disabled={disabled || loading}
                placeholder="搜索记忆标题或内容"
                className="pl-9"
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
            <Select
              value={kind || 'all'}
              disabled={disabled || loading}
              onValueChange={(value) => {
                setKind(value === 'all' ? '' : (value as AssistantMemoryKind))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full lg:w-32">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                {kindOptions.map((option) => (
                  <SelectItem
                    key={option.value || 'all'}
                    value={option.value || 'all'}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedButtons
              value={scope}
              options={scopeOptions}
              disabled={disabled || loading}
              onChange={(value) => {
                setScope(value as AssistantMemoryScope)
                setPage(1)
              }}
            />
            <SegmentedButtons
              value={status}
              options={statusOptions}
              disabled={disabled || loading}
              onChange={(value) => {
                setStatus(value as AssistantMemoryStatus)
                setPage(1)
              }}
            />
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="rounded-md border bg-muted/10 p-3">
            {creating ? (
              <MemoryEditor
                title={draft.title}
                content={draft.content}
                kind={draft.kind}
                disabled={disabled || Boolean(actionID)}
                saving={actionID === -1}
                onTitleChange={(value) =>
                  setDraft((current) => ({ ...current, title: value }))
                }
                onContentChange={(value) =>
                  setDraft((current) => ({ ...current, content: value }))
                }
                onKindChange={(value) =>
                  setDraft((current) => ({ ...current, kind: value }))
                }
                onSubmit={() => void submitDraft()}
                onCancel={resetDraft}
              />
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || loading}
                onClick={() => setCreating(true)}
              >
                <Plus className="me-1 size-4" />
                手动新增
              </Button>
            )}
          </div>

          <div className="min-h-80 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-dashed px-3 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载记忆
              </div>
            ) : null}

            {!loading && memories.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                暂无匹配的长期记忆。明确说“记住...”或表达长期规则后，系统会自动保存。
              </div>
            ) : null}

            {!loading
              ? memories.map((memory) => (
                  <MemoryItem
                    key={memory.id}
                    memory={memory}
                    disabled={disabled || Boolean(actionID)}
                    actionLoading={actionID === memory.id}
                    editing={editingID === memory.id}
                    editingTitle={editingTitle}
                    editingContent={editingContent}
                    editingKind={editingKind}
                    onEditingTitleChange={setEditingTitle}
                    onEditingContentChange={setEditingContent}
                    onEditingKindChange={setEditingKind}
                    onStartEdit={() => startEdit(memory)}
                    onSubmitEdit={() => void submitEdit()}
                    onCancelEdit={cancelEdit}
                    onDelete={() => void removeMemory(memory.id)}
                  />
                ))
              : null}
          </div>

          <div className="flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              共 {total} 条，记忆第 {currentPage} / {maxPage} 页
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

function MemoryItem({
  memory,
  disabled,
  actionLoading,
  editing,
  editingTitle,
  editingContent,
  editingKind,
  onEditingTitleChange,
  onEditingContentChange,
  onEditingKindChange,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
}: {
  memory: AssistantMemoryRecord
  disabled: boolean
  actionLoading: boolean
  editing: boolean
  editingTitle: string
  editingContent: string
  editingKind: AssistantMemoryKind
  onEditingTitleChange: (value: string) => void
  onEditingContentChange: (value: string) => void
  onEditingKindChange: (value: AssistantMemoryKind) => void
  onStartEdit: () => void
  onSubmitEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      {editing ? (
        <MemoryEditor
          title={editingTitle}
          content={editingContent}
          kind={editingKind}
          disabled={disabled}
          saving={actionLoading}
          onTitleChange={onEditingTitleChange}
          onContentChange={onEditingContentChange}
          onKindChange={onEditingKindChange}
          onSubmit={onSubmitEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-sm font-medium">
                {memory.title || `记忆 ${memory.id}`}
              </div>
              <Badge variant="outline">{kindLabel(memory.kind)}</Badge>
              {memory.status === 2 ? (
                <Badge variant="secondary">停用</Badge>
              ) : null}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {memory.content}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>重要度 {memory.importance || 0}</span>
              {memory.created_at ? <span>{formatTime(memory.created_at)}</span> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {actionLoading ? (
              <Loader2 className="mx-2 mt-1 size-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={disabled}
                  onClick={onStartEdit}
                >
                  <Edit2 className="size-4" />
                  <span className="sr-only">编辑记忆</span>
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={disabled}
                  onClick={onDelete}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">删除记忆</span>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MemoryEditor({
  title,
  content,
  kind,
  disabled,
  saving,
  onTitleChange,
  onContentChange,
  onKindChange,
  onSubmit,
  onCancel,
}: {
  title: string
  content: string
  kind: AssistantMemoryKind
  disabled: boolean
  saving: boolean
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onKindChange: (value: AssistantMemoryKind) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Input
          value={title}
          disabled={disabled || saving}
          placeholder="记忆标题"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <Select
          value={kind || 'semantic'}
          disabled={disabled || saving}
          onValueChange={(value) => onKindChange(value as AssistantMemoryKind)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            {kindOptions
              .filter((option) => option.value)
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={content}
        disabled={disabled || saving}
        placeholder="只保存长期稳定的偏好、项目约束、规则或事实"
        className="min-h-20"
        onChange={(event) => onContentChange(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={onCancel}
        >
          <X className="me-1 size-4" />
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || saving || !title.trim() || !content.trim()}
          onClick={onSubmit}
        >
          {saving ? (
            <Loader2 className="me-1 size-4 animate-spin" />
          ) : (
            <Check className="me-1 size-4" />
          )}
          保存
        </Button>
      </div>
    </div>
  )
}

function SegmentedButtons({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="flex rounded-md border bg-muted/20 p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'secondary' : 'ghost'}
          className="h-8 px-3"
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function kindLabel(kind: string) {
  return kindOptions.find((option) => option.value === kind)?.label || '记忆'
}

function formatTime(value?: string) {
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
