import { Paperclip } from 'lucide-react'
import { useMemo } from 'react'
import { useResourcePreviewDialog } from '@/components/resource/use-resource-preview'
import { LongText } from '@/components/long-text'
import { normalizeUploadItems } from '@/lib/resource'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'
import { resolveMediaMaxVisible } from './shared'

export function MediaFileList({ item, value }: NodeItemProps) {
  const files = useMemo(() => normalizeUploadItems(value), [value])
  const compact = item.meta?.compact === true
  const maxVisible = resolveMediaMaxVisible(item.meta, compact, files.length)
  const visibleFiles = compact ? files.slice(0, maxVisible) : files
  const { openPreview, previewDialog, hasItems } = useResourcePreviewDialog(files, {
    title: item.name ? `${item.name}详情` : '资源详情',
    description: '可查看当前文件资源详情；不支持在线预览的文件可直接下载。',
  })

  if (files.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        compact ? 'flex min-w-0 flex-col items-center gap-1 text-center' : 'space-y-2',
        !compact && item.className
      )}
    >
      {visibleFiles.map((file, index) => {
        if (compact) {
          return (
            <button
              type='button'
              key={String(file.id || index)}
              onClick={() => openPreview(file.id)}
              className='inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2 py-1 text-xs text-foreground transition hover:border-primary/40 hover:bg-muted/50'
            >
              <Paperclip className='size-3.5 shrink-0 text-muted-foreground' />
              <LongText className='max-w-full min-w-0 truncate' contentClassName='max-w-xs break-all'>
                {file.name || '文件资源'}
              </LongText>
            </button>
          )
        }

        return (
          <button
            type='button'
            key={String(file.id || index)}
            onClick={() => openPreview(file.id)}
            className='flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-muted/35'
          >
            <span className='flex min-w-0 items-center gap-2 text-foreground'>
              <Paperclip className='size-4 shrink-0 text-muted-foreground' />
              <LongText className='max-w-full min-w-0 truncate' contentClassName='max-w-sm break-all'>
                {file.name || '文件资源'}
              </LongText>
            </span>
          </button>
        )
      })}
      {hasItems ? previewDialog : null}
    </div>
  )
}
