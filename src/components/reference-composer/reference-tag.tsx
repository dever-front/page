import {
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Video,
  Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ReferencePreviewPopover,
  referencePreviewKind,
} from './reference-preview-popover'
import { referenceLabel } from './text'
import type {
  ReferencePreviewHint,
  ReferencePreviewLoader,
  ReferenceType,
} from './types'

type ReferenceTagProps = {
  label: string
  refType: ReferenceType
  refId: number
  trigger?: string
  versionId?: number
  hint?: ReferencePreviewHint
  loadPreview?: ReferencePreviewLoader
  selected?: boolean
  className?: string
  onDelete?: () => void
}

export function ReferenceTag({
  label,
  refType,
  refId,
  trigger,
  versionId,
  hint,
  loadPreview,
  selected = false,
  className,
  onDelete,
}: ReferenceTagProps) {
  const displayLabel = referenceLabel(label)
  return (
    <ReferencePreviewPopover
      label={displayLabel}
      refType={refType}
      refId={refId}
      trigger={trigger}
      versionId={versionId}
      hint={hint}
      loadPreview={loadPreview}
      onDelete={onDelete}
      triggerClassName='inline'
    >
      {(preview) => {
        const primaryMedia = preview?.media[0]
        const kind = referencePreviewKind(refType, hint, preview)
        const thumbnail = primaryMedia?.url || hint?.url
        return (
          <span
            data-reference-tag=''
            data-reference-type={refType}
            data-reference-id={refId}
            data-selected={selected || undefined}
            tabIndex={0}
            aria-label={`引用：${displayLabel}`}
            className={cn(
              'mx-1 inline-flex max-w-[min(22rem,78vw)] cursor-default items-center gap-1.5 rounded-md border border-slate-300/80 bg-slate-100/90 px-2 py-0.5 align-baseline text-[0.9em] leading-6 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors select-none hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700',
              selected && 'border-slate-500 ring-2 ring-slate-400/35',
              className
            )}
          >
            <ReferenceTagIcon kind={kind} url={thumbnail} />
            <span className='truncate'>{displayLabel}</span>
          </span>
        )
      }}
    </ReferencePreviewPopover>
  )
}

function ReferenceTagIcon({ kind, url }: { kind: string; url?: string }) {
  if (kind === 'image' && url) {
    return (
      <img
        src={url}
        alt=''
        aria-hidden='true'
        loading='lazy'
        decoding='async'
        className='size-4.5 shrink-0 rounded-sm object-cover'
      />
    )
  }
  const Icon =
    kind === 'image'
      ? ImageIcon
      : kind === 'video'
        ? Video
        : kind === 'audio'
          ? Volume2
          : kind === 'message' || kind === 'session'
            ? MessageSquare
            : FileText
  return (
    <Icon aria-hidden='true' className='size-3.5 shrink-0 text-slate-500' />
  )
}
