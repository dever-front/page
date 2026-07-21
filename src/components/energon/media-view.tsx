import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Play,
  UploadCloud,
} from 'lucide-react'
import { EnergonAudioPlayer } from '@/components/energon/audio-player'
import { Button } from '@/components/ui/button'
import { ResourcePreviewDialogLazy } from '@/components/resource/lazy-dialogs'
import { EnergonProgressBlock } from '@/components/energon/progress'
import {
  normalizeUploadItem,
  normalizeUploadUrlItems,
  resolveResourceKind,
  type ResourceUploadRule,
} from '@/lib/resource'
import {
  downloadUploadFile,
  importRemoteFileByRuleStream,
  type UploadFileItem,
} from '@/lib/upload'
import { cn } from '@/lib/utils'

export type EnergonMediaKind = 'image' | 'video' | 'audio' | 'file'
export type EnergonMediaLayout = 'default' | 'chat' | 'detail'

export type EnergonMediaPreviewItem = {
  id: string | number
  name: string
  url: string
  thumbnail?: string
}

export type EnergonMediaPreviewRequest = {
  kind: EnergonMediaKind
  items: EnergonMediaPreviewItem[]
  initialItemId?: string | number
  download: (itemId: string | number) => Promise<void>
  context?: unknown
}

export type EnergonMediaPreviewHandler = (
  request: EnergonMediaPreviewRequest
) => void

export type EnergonMediaActionContext = {
  kind: EnergonMediaKind
  item: EnergonMediaPreviewItem
  index: number
  layout: EnergonMediaLayout
}

export type EnergonMediaActionRenderer = (
  context: EnergonMediaActionContext
) => ReactNode

type EnergonMediaViewProps = {
  kind: EnergonMediaKind
  urls: string[]
  meta?: Record<string, any>
  uploadRules?: ResourceUploadRule[]
  layout?: EnergonMediaLayout
  previewLayerZIndex?: number
  onMediaPreview?: EnergonMediaPreviewHandler
  renderMediaActions?: EnergonMediaActionRenderer
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
  layout = 'default',
  previewLayerZIndex,
  onMediaPreview,
  renderMediaActions,
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
    const selectedItem = uploadedByURL[resourceURL(item)] || item
    if (onMediaPreview) {
      onMediaPreview({
        kind,
        items: previewItems.map((previewItem) => ({
          id: previewItem.id,
          name: previewItem.name,
          url: resourceURL(previewItem),
          thumbnail: String(previewItem.thumbnail || '').trim() || undefined,
        })),
        initialItemId: selectedItem.id,
        download: async (itemId) => {
          const downloadItem = previewItems.find(
            (previewItem) => String(previewItem.id) === String(itemId)
          )
          if (!downloadItem) {
            throw new Error('未找到要下载的资源')
          }
          await downloadUploadFile(downloadItem)
        },
      })
      return
    }
    setPreviewInitialID(selectedItem.id)
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
          layout={layout}
          onPreview={openPreview}
          onUpload={saveResource}
          renderMediaActions={renderMediaActions}
        />
      ) : (
        <MediaList
          kind={kind}
          items={previewItems}
          sourceItems={baseItems}
          meta={meta}
          uploadRule={uploadRule}
          uploadState={uploadState}
          uploadedByURL={uploadedByURL}
          layout={layout}
          onPreview={openPreview}
          onUpload={saveResource}
          renderMediaActions={renderMediaActions}
        />
      )}

      <UploadProgressList uploadState={uploadState} />

      {!onMediaPreview ? (
        <ResourcePreviewDialogLazy
          open={previewOpen}
          title="生成资源预览"
          description={
            uploadRule
              ? '可预览当前生成的图片、视频、音频或文件，也可以保存到资源库。'
              : '可预览当前生成的图片、视频、音频或文件。'
          }
          items={previewItems}
          initialItemId={previewInitialID}
          presentation={layout === 'chat' ? 'drawer' : 'dialog'}
          assistantLayer={layout === 'chat'}
          layerZIndex={previewLayerZIndex}
          onOpenChange={setPreviewOpen}
          renderActions={
            uploadRule
              ? (item) =>
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
              : undefined
          }
        />
      ) : null}
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
  layout,
  onPreview,
  onUpload,
  renderMediaActions,
}: {
  items: UploadFileItem[]
  sourceItems: UploadFileItem[]
  meta?: Record<string, any>
  uploadRule?: ResourceUploadRule
  uploadState: Record<string, UploadState>
  uploadedByURL: Record<string, UploadFileItem>
  layout: EnergonMediaLayout
  onPreview: (item: UploadFileItem) => void
  onUpload: (item: UploadFileItem) => void
  renderMediaActions?: EnergonMediaActionRenderer
}) {
  const chatAspectRatio = layout === 'chat' ? mediaAspectRatio(meta) : ''
  const detailLayout = layout === 'detail'

  return (
    <div
      className={cn(
        'grid',
        layout === 'chat' && 'agent-chat-media-grid',
        layout === 'default' && 'gap-3 sm:grid-cols-2',
        detailLayout && 'gap-6'
      )}
      data-count={layout === 'chat' ? items.length : undefined}
    >
      {items.map((item, index) => {
        const sourceItem = sourceItems[index] || item
        const url = resourceURL(item)
        const chatLayout = layout === 'chat'
        const mediaActions = renderMediaActions?.({
          kind: 'image',
          item: mediaPreviewItem(item),
          index,
          layout,
        })
        const showUploadAction = Boolean(
          uploadRule ||
            uploadedByURL[resourceURL(sourceItem)] ||
            Number(sourceItem.rule_id || 0) > 0
        )
        return (
          <div
            key={String(sourceItem.id)}
            className="group relative min-w-0"
          >
            <button
              type="button"
              className={cn(
                'block w-full overflow-hidden',
                layout !== 'detail' && 'rounded-lg',
                layout === 'default' && 'bg-muted/30',
                detailLayout && 'mx-auto max-w-6xl bg-transparent'
              )}
              style={
                chatAspectRatio ? { aspectRatio: chatAspectRatio } : undefined
              }
              onClick={() => onPreview(sourceItem)}
            >
              <img
                src={url}
                alt={item.name}
                className={cn(
                  'block w-full object-contain',
                  !detailLayout && 'transition-transform hover:scale-[1.01]',
                  chatLayout
                    ? chatAspectRatio
                      ? 'h-full rounded-lg object-cover'
                      : 'h-auto rounded-lg'
                    : detailLayout
                      ? 'mx-auto h-auto max-h-[calc(100dvh-9rem)]'
                      : 'max-h-80'
                )}
              />
            </button>
            {mediaActions ? (
              <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {mediaActions}
              </div>
            ) : null}
            {layout === 'default' && showUploadAction ? (
              <div className="mt-2 flex justify-end">
                <MediaUploadButton
                  item={sourceItem}
                  kind="image"
                  uploadRule={uploadRule}
                  uploadState={uploadState}
                  uploadedByURL={uploadedByURL}
                  onUpload={onUpload}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function mediaAspectRatio(meta?: Record<string, any>) {
  for (const value of [
    meta?.tool_ratio,
    meta?.aspectRatio,
    meta?.aspect_ratio,
    meta?.ratio,
  ]) {
    const ratio = normalizeAspectRatio(value)
    if (ratio) {
      return ratio
    }
  }
  const width = Number(meta?.width || 0)
  const height = Number(meta?.height || 0)
  return width > 0 && height > 0 ? `${width} / ${height}` : ''
}

function normalizeAspectRatio(value: unknown) {
  const match = String(value || '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0) {
    return ''
  }
  return `${match[1]} / ${match[2]}`
}

function MediaList({
  kind,
  items,
  sourceItems,
  meta,
  uploadRule,
  uploadState,
  uploadedByURL,
  layout,
  onPreview,
  onUpload,
  renderMediaActions,
}: {
  kind: EnergonMediaKind
  items: UploadFileItem[]
  sourceItems: UploadFileItem[]
  meta?: Record<string, any>
  uploadRule?: ResourceUploadRule
  uploadState: Record<string, UploadState>
  uploadedByURL: Record<string, UploadFileItem>
  layout: EnergonMediaLayout
  onPreview: (item: UploadFileItem) => void
  onUpload: (item: UploadFileItem) => void
  renderMediaActions?: EnergonMediaActionRenderer
}) {
  const bareAudio = kind === 'audio' && layout !== 'detail'
  const bareDefaultVideo = kind === 'video' && layout === 'default'
  const compactRows = kind === 'file'

  return (
    <div
      className={cn(
        layout === 'chat' ? 'agent-chat-media-grid' : 'space-y-3',
        layout === 'detail' && 'space-y-6',
        bareAudio && 'w-full max-w-[35rem]'
      )}
      data-count={layout === 'chat' ? items.length : undefined}
      data-kind={kind}
    >
      {items.map((item, index) => {
        const sourceItem = sourceItems[index] || item
        const mediaActions = renderMediaActions?.({
          kind,
          item: mediaPreviewItem(item),
          index,
          layout,
        })
        return (
          <div
            key={String(sourceItem.id)}
            className="group relative min-w-0"
          >
            {!compactRows || layout === 'detail' ? (
              <MediaPreviewInline
                kind={kind}
                item={item}
                meta={meta}
                layout={layout}
                hasOverlayAction={kind === 'video' && Boolean(mediaActions)}
                onPreview={() => onPreview(sourceItem)}
              />
            ) : null}
            {kind === 'video' && mediaActions ? (
              <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {mediaActions}
              </div>
            ) : null}
            {layout !== 'detail' && !(layout === 'chat' && kind === 'video') ? (
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2',
                  kind !== 'file' && 'justify-end',
                  (bareAudio || bareDefaultVideo) && 'mt-2'
                )}
              >
                {kind === 'file' ? (
                  <div className="min-w-0 flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="truncate">{item.name}</span>
                  </div>
                ) : null}
                <div className="flex shrink-0 items-center gap-2">
                  {kind !== 'video' ? mediaActions : null}
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
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function MediaPreviewInline({
  kind,
  item,
  meta,
  layout,
  hasOverlayAction,
  onPreview,
}: {
  kind: EnergonMediaKind
  item: UploadFileItem
  meta?: Record<string, any>
  layout: EnergonMediaLayout
  hasOverlayAction?: boolean
  onPreview: () => void
}) {
  const url = resourceURL(item)
  const detailLayout = layout === 'detail'
  if (kind === 'video') {
    return (
      <InlineVideoPreview
        item={item}
        meta={meta}
        layout={layout}
        hasOverlayAction={hasOverlayAction}
        onPreview={onPreview}
      />
    )
  }
  if (kind === 'audio') {
    const streaming = isEnergonMediaMetaFlag(meta, 'streaming_audio')
    return (
      <EnergonAudioPlayer
        src={url}
        detailed={detailLayout}
        autoPlay={streaming}
        className={cn(detailLayout && 'mx-auto max-w-3xl')}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={onPreview}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
        detailLayout
          ? 'mx-auto max-w-3xl bg-transparent hover:text-primary'
          : 'rounded-lg bg-muted/40 hover:bg-muted/60'
      )}
    >
      <FileText className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{url}</span>
      <Eye className="size-4 text-muted-foreground" />
    </button>
  )
}

function InlineVideoPreview({
  item,
  meta,
  layout,
  hasOverlayAction,
  onPreview,
}: {
  item: UploadFileItem
  meta?: Record<string, any>
  layout: EnergonMediaLayout
  hasOverlayAction?: boolean
  onPreview: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [intrinsicAspectRatio, setIntrinsicAspectRatio] = useState('')
  const url = resourceURL(item)
  const poster = String(item.thumbnail || '').trim() || undefined
  const detailLayout = layout === 'detail'

  if (layout !== 'chat') {
    return (
      <div
        className={cn(
          'group relative overflow-hidden',
          detailLayout
            ? 'mx-auto w-full max-w-6xl bg-transparent'
            : 'mx-auto w-fit max-w-full rounded-lg bg-transparent'
        )}
      >
        <video
          src={url}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          className={cn(
            detailLayout
              ? 'mx-auto block w-full max-h-[calc(100dvh-9rem)] bg-transparent object-contain'
              : 'block h-auto max-h-[32rem] max-w-full rounded-lg bg-transparent object-contain'
          )}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={cn(
            'absolute top-3 opacity-0 shadow-sm transition-opacity group-hover:opacity-100',
            hasOverlayAction ? 'right-14' : 'right-3'
          )}
          onClick={onPreview}
        >
          <Eye className="size-4" />
          预览
        </Button>
      </div>
    )
  }

  const aspectRatio = mediaAspectRatio(meta) || intrinsicAspectRatio
  const playInline = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const video = videoRef.current
    if (!video) {
      return
    }
    void video.play().catch(() => setPlaying(false))
  }

  return (
    <div
      className="group relative w-full overflow-hidden rounded-lg bg-black"
      style={{ aspectRatio }}
    >
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        controls={playing}
        playsInline
        preload="metadata"
        className={cn(
          'block w-full bg-black object-cover',
          aspectRatio && 'h-full'
        )}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setIntrinsicAspectRatio(`${video.videoWidth} / ${video.videoHeight}`)
          }
        }}
        onClick={(event) => {
          if (playing) {
            event.stopPropagation()
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {!playing ? (
        <>
          <button
            type="button"
            className="absolute inset-0 z-[1] cursor-zoom-in border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/70"
            onClick={onPreview}
            aria-label={`预览视频 ${item.name}`}
          />
          <button
            type="button"
            className="absolute left-1/2 top-1/2 z-[2] inline-flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-black/60 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            onClick={playInline}
            aria-label={`播放视频 ${item.name}`}
          >
            <Play aria-hidden="true" className="size-5 translate-x-px fill-current" />
          </button>
        </>
      ) : null}
    </div>
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

function mediaPreviewItem(item: UploadFileItem): EnergonMediaPreviewItem {
  return {
    id: item.id,
    name: item.name,
    url: resourceURL(item),
    thumbnail: String(item.thumbnail || '').trim() || undefined,
  }
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

export function isEnergonMediaMetaFlag(
  meta: Record<string, any> | undefined,
  key: string
) {
  const value = meta?.[key]
  if (typeof value === 'boolean') {
    return value
  }
  return ['1', 'true', 'yes', 'y', 'on'].includes(
    String(value || '').trim().toLowerCase()
  )
}
