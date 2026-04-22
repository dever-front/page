import { Video } from 'lucide-react'
import { useMemo } from 'react'
import { useResourcePreviewDialog } from '@/components/resource/use-resource-preview'
import { LongText } from '@/components/long-text'
import { normalizeUploadUrlItems } from '@/lib/resource'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'
import { resolveMediaMaxVisible } from './shared'

export function MediaVideo({ item, value, store }: NodeItemProps) {
  const titlePath = String(item.meta?.titlePath || '').trim()
  const titleValue = titlePath ? store.getState().getValueByPath(titlePath) : undefined
  const title = String(titleValue || item.name || '').trim()
  const compact = item.meta?.compact === true
  const previewItems = useMemo(
    () => {
      const items = normalizeUploadUrlItems(value || item.meta?.src, { kind: 'video' })
      if (!title || items.length === 0) {
        return items
      }
      return items.map((current, index) =>
        index === 0
          ? {
              ...current,
              name: title,
            }
          : current
      )
    },
    [item.meta?.src, title, value]
  )
  const maxVisible = resolveMediaMaxVisible(item.meta, compact, previewItems.length)
  const visibleItems = compact ? previewItems.slice(0, maxVisible) : previewItems
  const { openPreview, previewDialog, hasItems } = useResourcePreviewDialog(previewItems, {
    title: item.name ? `${item.name}详情` : '资源详情',
    description: '可查看当前视频资源详情。',
  })

  if (previewItems.length === 0) {
    return null
  }

  if (compact) {
    return (
      <>
        <div className='flex min-w-0 flex-col items-center gap-1 text-center'>
          {visibleItems.map((file, index) => {
            const targetURL = String(file.url || file.open_url || file.download || '').trim()
            if (!targetURL) {
              return null
            }

            return (
              <button
                key={String(file.id || index)}
                type='button'
                onClick={() => openPreview(file.id)}
                disabled={!hasItems}
                className='inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2 py-1 text-xs text-foreground transition hover:border-primary/40 hover:bg-muted/50'
              >
                <Video className='size-3.5 shrink-0 text-muted-foreground' />
                <LongText className='max-w-full min-w-0 truncate' contentClassName='max-w-xs break-all'>
                  {String(file.name || '').trim() || targetURL}
                </LongText>
              </button>
            )
          })}
        </div>
        {previewDialog}
      </>
    )
  }

  return (
    <div className={cn('space-y-2', item.className)}>
      {visibleItems.map((file, index) => {
        const targetURL = String(file.url || file.open_url || file.download || '').trim()
        if (!targetURL) {
          return null
        }

        return (
          <div
            key={String(file.id || index)}
            className='space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2'
          >
            <button
              type='button'
              onClick={() => openPreview(file.id)}
              disabled={!hasItems}
              className='inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground transition hover:text-primary'
            >
              <Video className='size-4 shrink-0 text-muted-foreground' />
              <LongText className='max-w-full min-w-0 truncate' contentClassName='max-w-xs break-all'>
                {String(file.name || '').trim() || targetURL}
              </LongText>
            </button>
            <video controls preload='metadata' src={targetURL} className='max-h-64 w-full rounded bg-black/90' />
          </div>
        )
      })}
      {previewDialog}
    </div>
  )
}
