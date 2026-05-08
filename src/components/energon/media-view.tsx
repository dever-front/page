import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Music4,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResourcePreviewDialog } from '@/components/resource/resource-preview-dialog'
import { EnergonProgressBlock } from '@/components/energon/progress'
import {
  normalizeUploadItem,
  normalizeUploadUrlItems,
  resolveResourceKind,
  type ResourceUploadRule,
} from '@/lib/resource'
import { importRemoteFileByRuleStream, type UploadFileItem } from '@/lib/upload'

type EnergonMediaKind = 'image' | 'video' | 'audio' | 'file'

type EnergonMediaViewProps = {
  kind: EnergonMediaKind
  urls: string[]
  meta?: Record<string, any>
  uploadRules?: ResourceUploadRule[]
}

type UploadState = {
  status: 'uploading' | 'done' | 'error'
  message: string
  progress?: number | null
}

export function EnergonMediaView({
  kind,
  urls,
  meta,
  uploadRules = [],
}: EnergonMediaViewProps) {
  const baseItems = useMemo(
    () => normalizeUploadUrlItems(urls, { kind }),
    [kind, urls]
  )
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewInitialID, setPreviewInitialID] = useState<string | number | undefined>()
  const [uploadState, setUploadState] = useState<Record<string, UploadState>>({})
  const [uploadedByURL, setUploadedByURL] = useState<Record<string, UploadFileItem>>({})

  const previewItems = useMemo(
    () => baseItems.map((item) => uploadedByURL[resourceURL(item)] || item),
    [baseItems, uploadedByURL]
  )
  const uploadRule = useMemo(
    () => resolveMediaUploadRule(uploadRules, kind),
    [kind, uploadRules]
  )

  if (baseItems.length === 0) {
    return null
  }

  const openPreview = (item: UploadFileItem) => {
    setPreviewInitialID((uploadedByURL[resourceURL(item)] || item).id)
    setPreviewOpen(true)
  }

  const saveResource = async (item: UploadFileItem) => {
    const sourceURL = resourceURL(item)
    if (!sourceURL || !uploadRule) {
      return
    }

    setUploadState((current) => ({
      ...current,
      [sourceURL]: {
        status: 'uploading',
        message: `正在保存${mediaKindLabel(kind)}到资源库`,
        progress: null,
      },
    }))

    try {
      const uploaded = await importRemoteFileByRuleStream(uploadRule.ruleId, sourceURL, {
        kind: uploadRule.kind || kind,
        name: item.name,
        bizKey: uploadRule.bizKey || 'energon',
        bizName: uploadRule.bizName || 'AI生成',
        categoryId: uploadRule.categoryId,
        onStatus: (status) => {
          setUploadState((current) => ({
            ...current,
            [sourceURL]: {
              status: 'uploading',
              message: status.message || `正在保存${mediaKindLabel(kind)}到资源库`,
              progress: status.progress,
            },
          }))
        },
      })
      setUploadedByURL((current) => ({
        ...current,
        [sourceURL]: normalizeUploadItem(uploaded),
      }))
      setUploadState((current) => ({
        ...current,
        [sourceURL]: {
          status: 'done',
          message: `${mediaKindLabel(kind)}已保存到资源库`,
          progress: 100,
        },
      }))
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        [sourceURL]: {
          status: 'error',
          message: error instanceof Error ? error.message : '保存资源失败',
          progress: null,
        },
      }))
    }
  }

  return (
    <div className="space-y-3">
      {kind === 'image' ? (
        <ImageGrid
          items={previewItems}
          sourceItems={baseItems}
          meta={meta}
          uploadRule={uploadRule}
          uploadState={uploadState}
          uploadedByURL={uploadedByURL}
          onPreview={openPreview}
          onUpload={saveResource}
        />
      ) : (
        <MediaList
          kind={kind}
          items={previewItems}
          sourceItems={baseItems}
          uploadRule={uploadRule}
          uploadState={uploadState}
          uploadedByURL={uploadedByURL}
          onPreview={openPreview}
          onUpload={saveResource}
        />
      )}

      <UploadProgressList uploadState={uploadState} />

      <ResourcePreviewDialog
        open={previewOpen}
        title="生成资源预览"
        description="可预览当前生成的图片、视频、音频或文件，也可以保存到资源库。"
        items={previewItems}
        initialItemId={previewInitialID}
        onOpenChange={setPreviewOpen}
        renderActions={(item) =>
          item ? (
            <MediaUploadButton
              item={resolveSourceItem(item, baseItems, uploadedByURL)}
              kind={kind}
              uploadRule={uploadRule}
              uploadState={uploadState}
              uploadedByURL={uploadedByURL}
              onUpload={saveResource}
            />
          ) : null
        }
      />
    </div>
  )
}

function ImageGrid({
  items,
  sourceItems,
  meta,
  uploadRule,
  uploadState,
  uploadedByURL,
  onPreview,
  onUpload,
}: {
  items: UploadFileItem[]
  sourceItems: UploadFileItem[]
  meta?: Record<string, any>
  uploadRule?: ResourceUploadRule
  uploadState: Record<string, UploadState>
  uploadedByURL: Record<string, UploadFileItem>
  onPreview: (item: UploadFileItem) => void
  onUpload: (item: UploadFileItem) => void
}) {
  const width = Number(meta?.width || 0)
  const height = Number(meta?.height || 0)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => {
        const sourceItem = sourceItems[index] || item
        const url = resourceURL(item)
        return (
          <div key={String(sourceItem.id)} className="rounded-xl border bg-background p-2">
            <button
              type="button"
              className="block w-full overflow-hidden rounded-lg bg-muted/30"
              onClick={() => onPreview(sourceItem)}
            >
              <img
                src={url}
                alt={item.name}
                className="max-h-80 w-full object-contain transition-transform hover:scale-[1.01]"
              />
            </button>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0 text-xs text-muted-foreground">
                <div className="truncate">{item.name}</div>
                {width > 0 && height > 0 ? <div>{width} x {height}</div> : null}
              </div>
              <MediaUploadButton
                item={sourceItem}
                kind="image"
                uploadRule={uploadRule}
                uploadState={uploadState}
                uploadedByURL={uploadedByURL}
                onUpload={onUpload}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MediaList({
  kind,
  items,
  sourceItems,
  uploadRule,
  uploadState,
  uploadedByURL,
  onPreview,
  onUpload,
}: {
  kind: EnergonMediaKind
  items: UploadFileItem[]
  sourceItems: UploadFileItem[]
  uploadRule?: ResourceUploadRule
  uploadState: Record<string, UploadState>
  uploadedByURL: Record<string, UploadFileItem>
  onPreview: (item: UploadFileItem) => void
  onUpload: (item: UploadFileItem) => void
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const sourceItem = sourceItems[index] || item
        return (
          <div key={String(sourceItem.id)} className="rounded-xl border bg-background p-3">
            <MediaPreviewInline kind={kind} item={item} onPreview={() => onPreview(sourceItem)} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2 text-sm">
                {kind === 'audio' ? <Music4 className="size-4 text-muted-foreground" /> : null}
                {kind === 'file' ? <FileText className="size-4 text-muted-foreground" /> : null}
                <span className="truncate">{item.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onPreview(sourceItem)}>
                  <Eye className="size-4" />
                  预览
                </Button>
                <MediaUploadButton
                  item={sourceItem}
                  kind={kind}
                  uploadRule={uploadRule}
                  uploadState={uploadState}
                  uploadedByURL={uploadedByURL}
                  onUpload={onUpload}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MediaPreviewInline({
  kind,
  item,
  onPreview,
}: {
  kind: EnergonMediaKind
  item: UploadFileItem
  onPreview: () => void
}) {
  const url = resourceURL(item)
  if (kind === 'video') {
    return (
      <div className="group relative overflow-hidden rounded-lg border bg-black">
        <video src={url} controls className="max-h-96 w-full bg-black" />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-3 top-3 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          onClick={onPreview}
        >
          <Eye className="size-4" />
          预览
        </Button>
      </div>
    )
  }
  if (kind === 'audio') {
    return (
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-sm text-muted-foreground">
            <Music4 className="size-4 shrink-0" />
            <span className="truncate">{item.name}</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onPreview}>
            <Eye className="size-4" />
            预览
          </Button>
        </div>
        <audio src={url} controls className="w-full" />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onPreview}
      className="flex w-full items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted/60"
    >
      <FileText className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{url}</span>
      <Eye className="size-4 text-muted-foreground" />
    </button>
  )
}

function MediaUploadButton({
  item,
  kind,
  uploadRule,
  uploadState,
  uploadedByURL,
  onUpload,
}: {
  item: UploadFileItem
  kind: EnergonMediaKind
  uploadRule?: ResourceUploadRule
  uploadState: Record<string, UploadState>
  uploadedByURL: Record<string, UploadFileItem>
  onUpload: (item: UploadFileItem) => void
}) {
  const sourceURL = resourceURL(item)
  const state = uploadState[sourceURL]
  const uploaded = !!uploadedByURL[sourceURL] || Number(item.rule_id || 0) > 0
  if (!uploadRule && !uploaded) {
    return null
  }

  if (uploaded || state?.status === 'done') {
    return (
      <Button type="button" size="sm" variant="secondary" disabled>
        <CheckCircle2 className="size-4" />
        已保存
      </Button>
    )
  }

  const uploading = state?.status === 'uploading'
  return (
    <Button
      type="button"
      size="sm"
      variant={state?.status === 'error' ? 'destructive' : 'outline'}
      disabled={uploading}
      onClick={() => onUpload(item)}
    >
      {uploading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <UploadCloud className="size-4" />
      )}
      {state?.status === 'error' ? '重试保存' : uploading ? '保存中' : `保存${mediaKindLabel(kind)}`}
    </Button>
  )
}

function UploadProgressList({
  uploadState,
}: {
  uploadState: Record<string, UploadState>
}) {
  const activeItems = Object.entries(uploadState)
    .map(([key, state]) => ({ key, state }))
    .filter(({ state }) => state.status === 'uploading' || state.status === 'error')
  if (activeItems.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {activeItems.map(({ key, state }) => (
        <EnergonProgressBlock
          key={key}
          message={state.message}
          percent={state.status === 'error' ? null : state.progress}
        />
      ))}
    </div>
  )
}

function resolveSourceItem(
  item: UploadFileItem,
  sourceItems: UploadFileItem[],
  uploadedByURL: Record<string, UploadFileItem>
) {
  for (const sourceItem of sourceItems) {
    const uploaded = uploadedByURL[resourceURL(sourceItem)]
    if (uploaded && String(uploaded.id) === String(item.id)) {
      return sourceItem
    }
  }
  return item
}

function resolveMediaUploadRule(rules: ResourceUploadRule[], kind: EnergonMediaKind) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return undefined
  }
  const normalizedKind = resolveResourceKind({ kind })
  return (
    rules.find((item) => resolveResourceKind({ kind: item.kind, accept: item.accept }) === normalizedKind) ||
    rules.find((item) => resolveResourceKind({ kind: item.kind, accept: item.accept }) === 'file') ||
    rules[0]
  )
}

function resourceURL(item: UploadFileItem) {
  return String(item.url || item.open_url || item.download || '').trim()
}

function mediaKindLabel(kind: EnergonMediaKind) {
  switch (kind) {
    case 'image':
      return '图片'
    case 'video':
      return '视频'
    case 'audio':
      return '音频'
    default:
      return '文件'
  }
}
