import { Music4 } from 'lucide-react'
import { useMemo } from 'react'
import { useResourcePreviewDialog } from '@/components/resource/use-resource-preview'
import { LongText } from '@/components/long-text'
import { normalizeUploadUrlItems } from '@/lib/resource'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'
import { resolveMediaMaxVisible } from './shared'

const AUDIO_PREVIEW_WIDTH_CLASS = 'w-full min-w-[16rem] max-w-sm'

export function MediaAudio({ item, value }: NodeItemProps) {
  const files = useMemo(
    () =>
      normalizeUploadUrlItems(value, {
        kind: 'audio',
        uploadType: 'audio',
      }),
    [value]
  )
  const { openPreview, previewDialog, hasItems } = useResourcePreviewDialog(files, {
    title: item.name ? `${item.name}详情` : '资源详情',
    description: '可查看当前音频资源详情。',
  })

  if (files.length === 0) {
    return null
  }

  const compact = item.meta?.compact === true
  const maxVisible = resolveMediaMaxVisible(item.meta, compact, files.length)
  const visibleFiles = compact ? files.slice(0, maxVisible) : files

  return (
    <div
      className={cn(
        'min-w-0 space-y-2',
        compact && 'flex min-w-0 flex-col items-center gap-1 text-center'
      )}
    >
      {visibleFiles.map((file, index) => {
        const targetURL = String(file.url || file.open_url || file.download || '').trim()
        if (!targetURL) {
          return null
        }

        return compact ? (
          <AudioLinkChip
            key={String(file.id || index)}
            name={file.name}
            onClick={() => openPreview(file.id)}
          />
        ) : (
          <AudioPreviewCard
            key={String(file.id || index)}
            name={file.name}
            url={targetURL}
            onPreview={() => openPreview(file.id)}
          />
        )
      })}
      {hasItems ? previewDialog : null}
    </div>
  )
}

function AudioLinkChip({ name, onClick }: { name?: string; onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2 py-1 text-xs text-foreground transition hover:border-primary/40 hover:bg-muted/50'
    >
      <Music4 className='size-3.5 shrink-0 text-muted-foreground' />
      <LongText className='max-w-full min-w-0 truncate' contentClassName='max-w-xs break-all'>
        {String(name || '').trim() || '音频资源'}
      </LongText>
    </button>
  )
}

function AudioPreviewCard({
  name,
  url,
  onPreview,
}: {
  name?: string
  url: string
  onPreview: () => void
}) {
  return (
    <div className={cn(AUDIO_PREVIEW_WIDTH_CLASS, 'space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2')}>
      <button
        type='button'
        onClick={onPreview}
        className='flex w-full min-w-0 items-center gap-1.5 text-sm font-medium text-foreground transition hover:text-primary'
      >
        <Music4 className='size-4 shrink-0 text-muted-foreground' />
        <LongText className='max-w-full min-w-0 truncate' contentClassName='max-w-xs break-all'>
          {String(name || '').trim() || url}
        </LongText>
      </button>
      <audio controls preload='none' src={url} className='h-9 w-full min-w-0' />
    </div>
  )
}
