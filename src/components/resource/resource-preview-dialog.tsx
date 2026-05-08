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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { downloadUploadFile, type UploadFileItem } from '@/lib/upload'
import {
  formatUploadSize,
  resolveResourcePreviewKind,
} from '@/lib/resource'

type ResourcePreviewDialogProps = {
  open: boolean
  title?: string
  description?: string
  items?: UploadFileItem[]
  initialItemId?: string | number
  onOpenChange: (open: boolean) => void
  renderActions?: (item?: UploadFileItem) => ReactNode
}

export function ResourcePreviewDialog({
  open,
  title = '资源详情',
  description = '可查看当前选中资源，支持图片、视频、音频与附件详情。',
  items = [],
  initialItemId,
  onOpenChange,
  renderActions,
}: ResourcePreviewDialogProps) {
  const previewItems = useMemo(() => items.filter(Boolean), [items])
  const [activeIndex, setActiveIndex] = useState(0)
  const currentItem = previewItems[activeIndex]
  const previewKind = resolveResourcePreviewKind(currentItem)
  const previewUrl = open ? resolvePreviewUrl(currentItem, previewKind) : ''
  const hasMultiple = previewItems.length > 1

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        layerClassName="z-[80]"
        className="flex h-[88vh] max-h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 px-6 py-6 sm:px-16">
            {hasMultiple ? (
              <PreviewSwitchButton
                direction="left"
                disabled={previewItems.length <= 1}
                onClick={() => jumpTo(-1)}
              />
            ) : null}

            <ResourcePreviewBody
              item={currentItem}
              previewKind={previewKind}
              previewUrl={previewUrl}
            />

            {hasMultiple ? (
              <PreviewSwitchButton
                direction="right"
                disabled={previewItems.length <= 1}
                onClick={() => jumpTo(1)}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-4 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <ResourcePreviewTitle title={currentItem?.name || '未选择资源'} />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {currentItem ? (
                  <>
                    <span>{formatUploadSize(Number(currentItem.size || 0))}</span>
                    {currentItem.ext ? (
                      <span>{String(currentItem.ext).replace(/^\./, '').toUpperCase()}</span>
                    ) : null}
                    {currentItem.created_at ? <span>{formatCreatedAt(currentItem.created_at)}</span> : null}
                    {previewItems.length > 1 ? (
                      <span>
                        {activeIndex + 1} / {previewItems.length}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span>当前资源暂不支持预览。</span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:justify-end">
              {renderActions?.(currentItem)}
              {hasMultiple ? (
                <>
                  <Button type="button" variant="outline" onClick={() => jumpTo(-1)}>
                    <ChevronLeft className="size-4" />
                    上一个
                  </Button>
                  <Button type="button" variant="outline" onClick={() => jumpTo(1)}>
                    下一个
                    <ChevronRight className="size-4" />
                  </Button>
                </>
              ) : null}
              {currentItem ? (
                <Button type="button" onClick={() => void downloadUploadFile(currentItem)}>
                  <Download className="size-4" />
                  下载
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    return String(item.thumbnail || item.url || item.download || item.open_url || '').trim()
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
      <video
        src={previewUrl}
        controls
        preload="metadata"
        className="max-h-full max-w-full rounded-xl bg-black shadow-sm"
      />
    )
  }

  if (previewKind === 'audio') {
    return (
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl border bg-background px-6 py-8 shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Music4 className="size-8" />
        </div>
        <div className="text-center text-sm font-medium text-foreground">{item.name}</div>
        <audio src={previewUrl} controls preload="metadata" className="w-full" />
      </div>
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
