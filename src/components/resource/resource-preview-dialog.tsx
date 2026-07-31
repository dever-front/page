import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileImage,
  Music4,
  Video,
} from 'lucide-react'
import { EnergonAudioPlayer } from '@/components/energon/audio-player'
import { FirstFrameVideo } from '@/components/media/first-frame-video'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { downloadUploadFile, type UploadFileItem } from '@/lib/upload'
import {
  formatUploadSize,
  resolveResourcePreviewKind,
} from '@/lib/resource'
import { cn } from '@/lib/utils'

export type ResourcePreviewDialogProps = {
  open: boolean
  title?: string
  description?: string
  items?: UploadFileItem[]
  initialItemId?: string | number
  onOpenChange: (open: boolean) => void
  assistantLayer?: boolean
  footerExtra?: ReactNode
  renderActions?: (item?: UploadFileItem) => ReactNode
  showDownload?: boolean
  layerClassName?: string
  layerZIndex?: number
  presentation?: 'dialog' | 'drawer'
}

export function ResourcePreviewDialog({
  open,
  title = '资源详情',
  description = '可查看当前选中资源，支持图片、视频、音频与附件详情。',
  items = [],
  initialItemId,
  onOpenChange,
  assistantLayer = false,
  footerExtra,
  renderActions,
  showDownload = true,
  layerClassName = 'z-[80]',
  layerZIndex,
  presentation = 'dialog',
}: ResourcePreviewDialogProps) {
  const previewItems = useMemo(() => items.filter(Boolean), [items])
  const [activeIndex, setActiveIndex] = useState(0)
  const currentItem = previewItems[activeIndex]
  const previewKind = resolveResourcePreviewKind(currentItem)
  const previewUrl = open ? resolvePreviewUrl(currentItem, previewKind) : ''
  const compactPreview =
    presentation === 'dialog' && (previewKind === 'audio' || previewKind === 'file')

  useEffect(() => {
    if (!open) {
      return
    }

    const nextIndex = previewItems.findIndex((item) => String(item.id) === String(initialItemId))
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0)
  }, [previewItems, initialItemId, open])

  useEffect(() => {
    if (!open || previewItems.length <= 1) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveIndex((current) => (current - 1 + previewItems.length) % previewItems.length)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % previewItems.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewItems.length, open])

  const jumpTo = (direction: -1 | 1) => {
    if (previewItems.length <= 1) {
      return
    }

    setActiveIndex((current) => (current + direction + previewItems.length) % previewItems.length)
  }

  const panel = (
    <ResourcePreviewPanel
      items={previewItems}
      activeIndex={activeIndex}
      currentItem={currentItem}
      previewKind={previewKind}
      previewUrl={previewUrl}
      presentation={presentation}
      compact={compactPreview}
      footerExtra={footerExtra}
      renderActions={renderActions}
      showDownload={showDownload}
      onSelect={setActiveIndex}
      onJump={jumpTo}
    />
  )

  if (presentation === 'drawer') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          data-assistant-layer={assistantLayer ? 'true' : undefined}
          layerClassName={layerClassName}
          layerZIndex={layerZIndex}
          side="right"
          showOverlay={false}
          className="w-full gap-0 overflow-hidden p-0 shadow-[-16px_0_40px_rgba(15,23,42,0.12)] sm:w-[66vw] sm:max-w-[66vw]"
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 text-start">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant-layer={assistantLayer ? 'true' : undefined}
        layerClassName={layerClassName}
        layerZIndex={layerZIndex}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          compactPreview
            ? 'max-h-[80vh] sm:max-w-3xl'
            : 'h-[88vh] max-h-[88vh] max-w-5xl'
        )}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  )
}

function ResourcePreviewPanel({
  items,
  activeIndex,
  currentItem,
  previewKind,
  previewUrl,
  presentation,
  compact,
  footerExtra,
  renderActions,
  showDownload,
  onSelect,
  onJump,
}: {
  items: UploadFileItem[]
  activeIndex: number
  currentItem?: UploadFileItem
  previewKind: string
  previewUrl: string
  presentation: 'dialog' | 'drawer'
  compact: boolean
  footerExtra?: ReactNode
  renderActions?: (item?: UploadFileItem) => ReactNode
  showDownload: boolean
  onSelect: (index: number) => void
  onJump: (direction: -1 | 1) => void
}) {
  const hasMultiple = items.length > 1
  const drawer = presentation === 'drawer'

  return (
    <div className={cn('flex min-h-0 flex-col', compact ? 'flex-none' : 'flex-1')}>
      <div className={cn('flex min-h-0', compact ? 'flex-none' : 'flex-1')}>
        <div
          className={cn(
            'relative flex w-full min-w-0 items-center justify-center overflow-hidden bg-muted/20 px-6 py-6 sm:px-12',
            compact ? 'min-h-64 flex-none' : 'flex-1'
          )}
        >
          {hasMultiple && !drawer ? (
            <PreviewSwitchButton direction="left" onClick={() => onJump(-1)} />
          ) : null}

          <ResourcePreviewBody
            item={currentItem}
            previewKind={previewKind}
            previewUrl={previewUrl}
          />

          {hasMultiple && !drawer ? (
            <PreviewSwitchButton direction="right" onClick={() => onJump(1)} />
          ) : null}
        </div>

        {drawer && hasMultiple ? (
          <ResourcePreviewRail
            items={items}
            activeIndex={activeIndex}
            onSelect={onSelect}
          />
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-4 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <ResourcePreviewTitle title={currentItem?.name || '未选择资源'} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {currentItem ? (
              <>
                <span>{formatUploadSize(Number(currentItem.size || 0))}</span>
                {currentItem.ext ? (
                  <span>{String(currentItem.ext).replace(/^\./, '').toUpperCase()}</span>
                ) : null}
                {currentItem.created_at ? (
                  <span>{formatCreatedAt(currentItem.created_at)}</span>
                ) : null}
                {hasMultiple ? (
                  <span>
                    {activeIndex + 1} / {items.length}
                  </span>
                ) : null}
              </>
            ) : (
              <span>当前资源暂不支持预览。</span>
            )}
          </div>
          {footerExtra ? <div className="pt-1">{footerExtra}</div> : null}
        </div>

        <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:justify-end">
          {renderActions?.(currentItem)}
          {hasMultiple && !drawer ? (
            <>
              <Button type="button" variant="outline" onClick={() => onJump(-1)}>
                <ChevronLeft className="size-4" />
                上一个
              </Button>
              <Button type="button" variant="outline" onClick={() => onJump(1)}>
                下一个
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
          {showDownload && currentItem ? (
            <Button type="button" onClick={() => void downloadUploadFile(currentItem)}>
              <Download className="size-4" />
              下载
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ResourcePreviewRail({
  items,
  activeIndex,
  onSelect,
}: {
  items: UploadFileItem[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <aside className="w-20 shrink-0 overflow-y-auto border-l bg-background px-2 py-3">
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <ResourcePreviewThumbnail
            key={`${String(item.id || item.url || item.name)}-${index}`}
            item={item}
            active={index === activeIndex}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
    </aside>
  )
}

function ResourcePreviewThumbnail({
  item,
  active,
  onClick,
}: {
  item: UploadFileItem
  active: boolean
  onClick: () => void
}) {
  const kind = resolveResourcePreviewKind(item)
  const thumbnail = String(
    item.thumbnail ||
      (kind === 'image' ? item.url || item.download || item.open_url : '') ||
      ''
  ).trim()

  return (
    <button
      type="button"
      title={item.name}
      aria-label={`预览${item.name || '资源'}`}
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={
        active
          ? 'flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border-2 border-foreground bg-muted'
          : 'flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted/40 hover:border-foreground/40'
      }
    >
      {thumbnail ? (
        <img src={thumbnail} alt={item.name} className="h-full w-full object-cover" />
      ) : kind === 'video' ? (
        <Video className="size-5 text-muted-foreground" />
      ) : kind === 'audio' ? (
        <Music4 className="size-5 text-muted-foreground" />
      ) : (
        <File className="size-5 text-muted-foreground" />
      )}
    </button>
  )
}

function resolvePreviewUrl(item: UploadFileItem | undefined, previewKind: string) {
  if (!item) {
    return ''
  }

  if (!previewKind) {
    return ''
  }

  if (previewKind === 'image') {
    return String(item.url || item.download || item.open_url || item.thumbnail || '').trim()
  }

  return String(item.url || item.download || item.open_url || item.thumbnail || '').trim()
}

function ResourcePreviewBody({
  item,
  previewKind,
  previewUrl,
}: {
  item?: UploadFileItem
  previewKind: string
  previewUrl: string
}) {
  if (!item) {
    return (
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <File className="size-10" />
        <span className="text-sm">暂无可预览资源</span>
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        {previewKind === 'video' ? <Video className="size-10" /> : null}
        {previewKind === 'audio' ? <Music4 className="size-10" /> : null}
        {previewKind === 'image' ? <FileImage className="size-10" /> : null}
        {!previewKind ? <File className="size-10" /> : null}
        <span className="text-sm">
          {previewKind ? '加载预览中...' : '当前资源暂不支持在线预览，请使用右下角下载。'}
        </span>
      </div>
    )
  }

  if (previewKind === 'image') {
    return (
      <img
        src={previewUrl}
        alt={item.name}
        className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
      />
    )
  }

  if (previewKind === 'video') {
    return (
      <FirstFrameVideo
        src={previewUrl}
        controls
        preload="metadata"
        className="max-h-full max-w-full rounded-xl bg-black shadow-sm"
      />
    )
  }

  if (previewKind === 'audio') {
    return (
      <EnergonAudioPlayer
        src={previewUrl}
        detailed
        className="max-w-3xl"
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <File className="size-10" />
      <span className="text-sm">当前资源暂不支持预览。</span>
    </div>
  )
}

function ResourcePreviewTitle({ title }: { title: string }) {
  const text = String(title || '').trim() || '未选择资源'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="truncate text-sm font-medium text-foreground">{text}</div>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-[32rem] break-all">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function PreviewSwitchButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right'
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className={
        direction === 'left'
          ? 'absolute left-4 top-1/2 -translate-y-1/2'
          : 'absolute right-4 top-1/2 -translate-y-1/2'
      }
      disabled={disabled}
      onClick={onClick}
    >
      {direction === 'left' ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </Button>
  )
}

function formatCreatedAt(value: string) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }

  const [date] = text.split(/[ T]/)
  return date || text
}
