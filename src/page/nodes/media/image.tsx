/**
 * Media/Image.tsx - 图片展示
 */
import { useMemo } from 'react'
import { useResourcePreviewDialog } from '@/components/resource/use-resource-preview'
import { normalizeUploadUrlItems } from '@/lib/resource'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'
import { resolveMediaMaxVisible } from './shared'

const imageObjectFits = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const
type ImageObjectFit = (typeof imageObjectFits)[number]

export function MediaImage({ item, value }: NodeItemProps) {
  const compact = item.meta?.compact === true
  const width = Number(item.meta?.width || (compact ? 40 : 0)) || undefined
  const height = Number(item.meta?.height || (compact ? 40 : 0)) || undefined
  const objectFit = resolveImageObjectFit(item.meta?.objectFit, width, height)
  const previewItems = useMemo(
    () => normalizeUploadUrlItems(value || item.meta?.src, { kind: 'image' }),
    [item.meta?.src, value]
  )
  const maxVisible = resolveMediaMaxVisible(item.meta, compact, previewItems.length)
  const visibleItems = compact ? previewItems.slice(0, maxVisible) : previewItems
  const { openPreview, previewDialog, hasItems } = useResourcePreviewDialog(previewItems, {
    title: item.name ? `${item.name}详情` : '资源详情',
    description: '可查看当前图片资源详情。',
  })

  if (previewItems.length === 0) {
    return null
  }

  if (compact) {
    return (
      <>
        <div className={cn('flex flex-wrap items-center justify-center gap-2', item.className)}>
          {visibleItems.map((file, index) => {
            const src = String(file.url || file.open_url || file.download || '').trim()
            if (!src) {
              return null
            }

            return (
              <button
                key={String(file.id || index)}
                type='button'
                onClick={() => openPreview(file.id)}
                disabled={!hasItems}
                className='inline-block overflow-hidden rounded-lg border border-border/70 bg-muted/15 text-left transition hover:border-primary/40 hover:shadow-sm'
                style={{
                  width,
                  height,
                  minWidth: width,
                }}
              >
                <img
                  src={src}
                  alt={file.name || item.name || ''}
                  className='size-full rounded-lg object-cover'
                />
              </button>
            )
          })}
        </div>
        {previewDialog}
      </>
    )
  }

  return (
    <>
      <div className={cn('flex flex-wrap items-start gap-3', item.className)}>
        {visibleItems.map((file, index) => {
          const src = String(file.url || file.open_url || file.download || '').trim()
          if (!src) {
            return null
          }

          return (
            <button
              key={String(file.id || index)}
              type='button'
              onClick={() => openPreview(file.id)}
              disabled={!hasItems}
              className='inline-block text-left transition hover:opacity-95'
            >
              <img
                src={src}
                alt={file.name || item.name || ''}
                className='block max-w-full rounded'
                style={{
                  width,
                  height,
                  objectFit,
                }}
              />
            </button>
          )
        })}
      </div>
      {previewDialog}
    </>
  )
}

function resolveImageObjectFit(
  configured: unknown,
  width?: number,
  height?: number
): ImageObjectFit | undefined {
  const value = String(configured || '').trim()
  if (imageObjectFits.includes(value as ImageObjectFit)) {
    return value as ImageObjectFit
  }

  return width && height ? 'cover' : undefined
}
