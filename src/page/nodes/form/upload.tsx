import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react'
import { useStore } from 'zustand'
import {
  Eye,
  FolderOpen,
  GripVertical,
  Paperclip,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { FirstFrameVideo } from '@/components/media/first-frame-video'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LongText } from '@/components/long-text'
import {
  ResourcePickerDialogLazy,
  ResourcePreviewDialogLazy,
} from '@/components/resource/lazy-dialogs'
import { AssistantMediaGenerateLazyButton } from '@/components/assistant/lazy-media-generate'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { inferRelationPath } from '@/lib/relation-field'
import {
  formatUploadSize,
  isPreviewableResource,
  mergeResourceUploadRules,
  resolveResourcePreviewKind,
  resolveUploadActionLabel,
  resolveResourceKind,
  serializeUploadUrlItems,
} from '@/lib/resource'
import {
  downloadUploadFile,
  uploadFileByRule,
  type UploadFileItem,
} from '@/lib/upload'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import { moveArrayItem } from '@/lib/array'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'
import type { AssistantMediaKind } from '@/lib/assistant/media'
import {
  buildUploadRules,
  resolveUploadEmptyText,
  resolveUploadItems,
  resolveUploadMaxCount,
  resolveUploadSaveMode,
  resolveUploadTypeIcon,
} from './upload/helpers'

export function FormUpload({ item, value, setValue, error, store }: NodeItemProps) {
  const uploadType = String(item.meta?.uploadType || 'list').trim() || 'list'
  const saveMode = resolveUploadSaveMode(item)
  const maxCount = resolveUploadMaxCount(item, uploadType)
  const multiple = maxCount > 1
  const relationPath = inferRelationPath(item.value)
  const relationValue = useStore(store, (state) =>
    relationPath ? state.getValueByPath(relationPath) : undefined
  )
  const files = useMemo(
    () => resolveUploadItems(relationValue, value, multiple, saveMode, item, uploadType),
    [item, multiple, relationValue, saveMode, uploadType, value]
  )
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItems, setPreviewItems] = useState<UploadFileItem[]>([])
  const [previewInitialID, setPreviewInitialID] = useState<UploadFileItem['id'] | undefined>()
  const [uploadMessage, setUploadMessage] = useState('')
  const [progress, setProgress] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const sortable = multiple && files.length > 1
  const disabled = uploading || !!item.meta?.disabled
  const resourceKind = resolveResourceKind({
    kind: item.meta?.kind,
    uploadType,
  })
  const ruleIdPath = String(item.meta?.ruleIdPath || '').trim()
  const ruleIdFromPath = useStore(store, (state) =>
    ruleIdPath ? state.getValueByPath(ruleIdPath) : undefined
  )
  const baseUploadRules = useMemo(
    () => buildUploadRules(item, resourceKind, ruleIdFromPath),
    [item, resourceKind, ruleIdFromPath]
  )
  const uploadRuleMetas = useUploadRuleMetas(baseUploadRules.map((current) => current.ruleId))
  const uploadRules = useMemo(
    () => mergeResourceUploadRules(baseUploadRules, uploadRuleMetas),
    [baseUploadRules, uploadRuleMetas]
  )
  const uploadActionLabel = useMemo(
    () => resolveUploadActionLabel(uploadRules, resourceKind),
    [resourceKind, uploadRules]
  )
  const assistantMediaKind = resolveUploadAssistantMediaKind(resourceKind)
  const assistantMaxResults = multiple ? Math.max(maxCount - files.length, 0) : 1
  const assistantGenerateDisabled =
    disabled || assistantMaxResults <= 0 || (saveMode !== 'url' && uploadRules.length === 0)

  const syncFiles = (nextFiles: UploadFileItem[]) => {
    if (!item.value) {
      return
    }

    if (saveMode === 'url') {
      setValue(serializeUploadUrlItems(nextFiles))
      return
    }

    if (multiple) {
      setValue(nextFiles.map((current) => current.id))
      if (relationPath) {
        store.getState().setValueByPath(relationPath, nextFiles)
      }
      return
    }

    const currentFile = nextFiles[0]
    setValue(currentFile?.id ?? 0)
    if (relationPath) {
      store.getState().setValueByPath(relationPath, currentFile || '')
    }
  }

  const handleChooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    if (selected.length === 0) {
      return
    }

    const uploadRule = uploadRules[0]
    if (!uploadRule) {
      setUploadMessage('未配置上传规则。')
      return
    }

    const remainingCount = Math.max(maxCount - files.length, 0)
    if (multiple && remainingCount <= 0) {
      setUploadMessage(`最多只能上传 ${maxCount} 个文件。`)
      return
    }

    const nextSelected = multiple ? selected.slice(0, remainingCount) : selected.slice(0, 1)
    if (nextSelected.length === 0) {
      setUploadMessage(`最多只能上传 ${maxCount} 个文件。`)
      return
    }

    setUploading(true)
    setUploadMessage('')
    setProgress('')

    try {
      let nextFiles = multiple ? [...files] : []
      for (const current of nextSelected) {
        const uploaded = await uploadFileByRule(uploadRule.ruleId, current, {
          kind: uploadRule.kind,
          bizKey: uploadRule.bizKey,
          bizName: uploadRule.bizName,
          categoryId: uploadRule.categoryId,
          transport: uploadRule.transport,
          onProgress: (loaded, total) => {
            const percent = Math.min(100, Math.round((loaded / Math.max(total, 1)) * 100))
            setProgress(`${current.name} ${percent}%`)
          },
        })
        nextFiles = multiple ? [...nextFiles, uploaded] : [uploaded]
      }

      syncFiles(nextFiles)
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  const handleRemove = (targetID: UploadFileItem['id']) => {
    const nextFiles = files.filter((current) => String(current.id) !== String(targetID))
    syncFiles(nextFiles)
  }

  const handleMoveFile = (fromIndex: number, toIndex: number) => {
    if (!multiple || fromIndex === toIndex) {
      return
    }
    syncFiles(moveArrayItem(files, fromIndex, toIndex))
  }

  const handleGeneratedFiles = (items: UploadFileItem[]) => {
    const nextItems = multiple
      ? [...files, ...items].slice(0, maxCount)
      : items.slice(0, 1)
    syncFiles(nextItems)
    setUploadMessage('')
  }

  const pickerTitle = item.name ? `${item.name}资源库` : '资源库'
  const pickerDescription = item.info || '可直接上传新资源，也可以从已有资源中选择替换。'
  const previewTitle = item.name ? `${item.name}详情` : '资源详情'

  const openPreview = (targetID?: UploadFileItem['id']) => {
    const mediaItems = files.filter((current) => isPreviewableResource(current))
    if (mediaItems.length === 0) {
      return
    }

    setPreviewItems(mediaItems)
    setPreviewInitialID(targetID ?? mediaItems[0]?.id)
    setPreviewOpen(true)
  }

  return (
    <div className="w-full space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={uploadRules[0]?.accept}
        onChange={handleChooseFiles}
      />

      {renderUploadBody({
        uploadType,
        files,
        disabled,
        error,
        uploading,
        uploadActionLabel,
        placeholder: item.placeholder,
        multiple,
        sortable,
        onSelect: () => inputRef.current?.click(),
        onOpenPicker: () => setPickerOpen(true),
        aiGenerateAction: (
          <AssistantMediaGenerateLazyButton
            store={store}
            item={item}
            kind={assistantMediaKind}
            surface="upload"
            uploadRules={uploadRules}
            maxResults={assistantMaxResults}
            disabled={assistantGenerateDisabled}
            className={resolveUploadAIGenerateClassName(uploadType)}
            size={isMediaUploadType(uploadType) ? 'icon' : 'sm'}
            iconOnly={isMediaUploadType(uploadType)}
            onGenerated={handleGeneratedFiles}
          />
        ),
        onRemove: handleRemove,
        onPreview: openPreview,
        onDragStart: (index) => setDragIndex(index),
        onDragOver: (event) => {
          if (!sortable) {
            return
          }
          event.preventDefault()
        },
        onDrop: (index) => {
          if (!sortable || dragIndex == null) {
            setDragIndex(null)
            return
          }
          handleMoveFile(dragIndex, index)
          setDragIndex(null)
        },
        onDragEnd: () => setDragIndex(null),
      })}

      {progress ? <p className="text-xs text-muted-foreground">{progress}</p> : null}
      {uploadMessage ? <p className="text-xs text-destructive">{uploadMessage}</p> : null}

      {pickerOpen ? (
        <ResourcePickerDialogLazy
          open={pickerOpen}
          title={pickerTitle}
          description={pickerDescription}
          bizKey={uploadRules[0]?.bizKey}
          initialScope={uploadRules[0]?.bizKey ? 'current' : 'all'}
          defaultKind={resourceKind}
          fixedKind={true}
          value={files}
          multiple={multiple}
          maxSelection={maxCount}
          emptyText={resolveUploadEmptyText(uploadType)}
          uploadRules={uploadRules}
          onOpenChange={setPickerOpen}
          onConfirm={syncFiles}
        />
      ) : null}

      {previewOpen ? (
        <ResourcePreviewDialogLazy
          open={previewOpen}
          title={previewTitle}
          items={previewItems}
          initialItemId={previewInitialID}
          onOpenChange={setPreviewOpen}
        />
      ) : null}
    </div>
  )
}

function renderUploadBody({
  uploadType,
  files,
  disabled,
  error,
  uploading,
  uploadActionLabel,
  placeholder,
  multiple,
  sortable,
  onSelect,
  onOpenPicker,
  aiGenerateAction,
  onRemove,
  onPreview,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  uploadType: string
  files: UploadFileItem[]
  disabled: boolean
  error?: string
  uploading: boolean
  uploadActionLabel: string
  placeholder?: string
  multiple: boolean
  sortable: boolean
  onSelect: () => void
  onOpenPicker: () => void
  aiGenerateAction?: ReactNode
  onRemove: (targetID: UploadFileItem['id']) => void
  onPreview: (targetID?: UploadFileItem['id']) => void
  onDragStart: (index: number) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
}) {
  switch (uploadType) {
    case 'pic':
    case 'video':
    case 'audio':
      return (
        <div className="space-y-3">
          {multiple ? (
            <div className="text-xs text-muted-foreground">
              已选择 {files.length} 个文件{sortable ? '，可拖动排序。' : '。'}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {files.map((file, index) => (
              <SelectedMediaTile
                key={String(file.id)}
                file={file}
                uploadType={uploadType}
                previewable={isPreviewableResource(file)}
                sortable={sortable}
                onPreview={() => onPreview(file.id)}
                onRemove={() => onRemove(file.id)}
                removeDisabled={disabled}
                onDragStart={() => onDragStart(index)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(index)}
                onDragEnd={onDragEnd}
              />
            ))}
            <UploadActionTile
              icon={<Upload className="size-8" />}
              label={uploading ? '上传中...' : uploadActionLabel}
              disabled={disabled}
              onClick={onSelect}
              adornment={aiGenerateAction}
            />
            <UploadActionTile
              icon={<FolderOpen className="size-8" />}
              label="资源库"
              disabled={disabled}
              onClick={onOpenPicker}
            />
          </div>
        </div>
      )

    case 'input':
      return (
        <div className="flex w-full flex-wrap items-center gap-2">
          <Input
            readOnly
            value={files[0]?.name || ''}
            placeholder={placeholder || '请选择文件'}
            aria-invalid={!!error}
            className={cn(
              'flex-1',
              error &&
                'border-destructive ring-destructive/20 focus-visible:ring-destructive/30'
            )}
          />
          <Button type="button" variant="outline" disabled={disabled} onClick={onSelect}>
            <Paperclip className="size-4" />
            {uploading ? '上传中...' : uploadActionLabel}
          </Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={onOpenPicker}>
            <FolderOpen className="size-4" />
            资源库
          </Button>
          {aiGenerateAction}
          {files[0] && isPreviewableResource(files[0]) ? (
            <Button type="button" variant="outline" onClick={() => onPreview(files[0].id)}>
              <Eye className="size-4" />
              查看
            </Button>
          ) : null}
          {files[0] ? (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onRemove(files[0].id)}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      )

    default:
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" disabled={disabled} onClick={onSelect}>
                <Upload className="size-4" />
                {uploading ? '上传中...' : uploadActionLabel}
              </Button>
              <Button type="button" variant="outline" disabled={disabled} onClick={onOpenPicker}>
                <FolderOpen className="size-4" />
                资源库
              </Button>
              {aiGenerateAction}
            </div>
            <span className="text-xs text-muted-foreground">
              已选择 {files.length} 个文件{sortable ? '，可拖动排序。' : ''}
            </span>
          </div>
          <div className="rounded-xl border border-border/70 bg-background shadow-xs">
            <Table className="table-fixed">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  {sortable ? <TableHead className="w-14 text-center">排序</TableHead> : null}
                  <TableHead className="w-auto whitespace-normal">文件名</TableHead>
                  <TableHead className="w-24">大小</TableHead>
                  <TableHead className="w-[170px] whitespace-normal">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={sortable ? 4 : 3}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      暂无附件
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((current, index) => (
                    <TableRow
                      key={String(current.id)}
                      className="hover:bg-transparent"
                      draggable={sortable}
                      onDragStart={() => onDragStart(index)}
                      onDragOver={sortable ? onDragOver : undefined}
                      onDrop={() => onDrop(index)}
                      onDragEnd={onDragEnd}
                    >
                      {sortable ? (
                        <TableCell className="px-2 py-3">
                          <div className="flex justify-center">
                            <button
                              type="button"
                              className="inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                              aria-label="拖动排序"
                            >
                              <GripVertical className="size-4" />
                            </button>
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell className="max-w-0 whitespace-normal">
                        <LongText
                          className="block max-w-[18rem] text-sm"
                          contentClassName="max-w-[32rem] break-all"
                        >
                          {current.name}
                        </LongText>
                      </TableCell>
                      <TableCell>{formatUploadSize(Number(current.size || 0))}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-wrap gap-1">
                          {isPreviewableResource(current) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => onPreview(current.id)}
                            >
                              查看
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => void downloadUploadFile(current)}
                          >
                            下载
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            disabled={disabled}
                            onClick={() => onRemove(current.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )
  }
}

function UploadActionTile({
  icon,
  label,
  disabled,
  onClick,
  adornment,
}: {
  icon: ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
  adornment?: ReactNode
}) {
  const tile = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex size-36 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-background text-muted-foreground transition hover:border-primary/40 hover:bg-muted/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60'
      )}
      onClick={onClick}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  )

  if (!adornment) {
    return tile
  }

  return (
    <div className="relative size-36">
      {tile}
      <div className="absolute right-2 top-2 z-10">{adornment}</div>
    </div>
  )
}

function resolveUploadAssistantMediaKind(kind: string): AssistantMediaKind {
  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    return kind
  }
  return 'file'
}

function resolveUploadAIGenerateClassName(uploadType: string) {
  if (isMediaUploadType(uploadType)) {
    return 'size-8 rounded-full border-border/80 bg-background/95 p-0 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground'
  }
  return 'gap-1.5'
}

function isMediaUploadType(uploadType: string) {
  return uploadType === 'pic' || uploadType === 'video' || uploadType === 'audio'
}

function SelectedMediaTile({
  file,
  uploadType,
  previewable,
  sortable,
  onPreview,
  onRemove,
  removeDisabled,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  file: UploadFileItem
  uploadType: string
  previewable?: boolean
  sortable?: boolean
  onPreview?: () => void
  onRemove: () => void
  removeDisabled: boolean
  onDragStart?: () => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: () => void
  onDragEnd?: () => void
}) {
  const previewKind = resolveResourcePreviewKind(file)
  const previewUrl =
    previewKind === 'image'
      ? String(file.thumbnail || file.url || file.download || file.open_url || '').trim()
      : String(file.url || file.download || file.open_url || file.thumbnail || '').trim()

  return (
    <div
      role={previewable ? 'button' : undefined}
      tabIndex={previewable ? 0 : undefined}
      className={cn(
        'group relative size-36 overflow-hidden rounded-2xl border bg-muted/20',
        previewable &&
          'cursor-pointer transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
      )}
      draggable={sortable}
      onClick={previewable ? onPreview : undefined}
      onDragStart={sortable ? onDragStart : undefined}
      onDragOver={sortable ? onDragOver : undefined}
      onDrop={sortable ? onDrop : undefined}
      onDragEnd={sortable ? onDragEnd : undefined}
      onKeyDown={(event) => {
        if (!previewable || !onPreview) {
          return
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        onPreview()
      }}
    >
      <SelectedMediaTileBody
        file={file}
        uploadType={uploadType}
        previewKind={previewKind}
        previewUrl={previewUrl}
      />
      {sortable ? (
        <div className="absolute left-2 top-2">
          <button
            type="button"
            className="inline-flex size-8 cursor-grab items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground active:cursor-grabbing"
            aria-label="拖动排序"
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="size-4" />
          </button>
        </div>
      ) : null}
      {previewable ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/5 to-transparent opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="mb-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
            点击查看资源
          </span>
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-2 top-2 size-8"
        disabled={removeDisabled}
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function SelectedMediaTileBody({
  file,
  uploadType,
  previewKind,
  previewUrl,
}: {
  file: UploadFileItem
  uploadType: string
  previewKind: string
  previewUrl: string
}) {
  if (previewKind === 'image' && previewUrl) {
    return <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
  }

  if (previewKind === 'video' && previewUrl) {
    return (
      <FirstFrameVideo
        src={previewUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/10 px-3 text-center text-muted-foreground">
      {resolveUploadTypeIcon(uploadType, previewKind)}
      <LongText className="max-w-full text-xs font-medium" contentClassName="max-w-[18rem] break-all">
        {file.name}
      </LongText>
    </div>
  )
}
