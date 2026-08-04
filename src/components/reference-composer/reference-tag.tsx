import {
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Video,
  Volume2,
  X,
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
  ReferenceUsageOption,
} from './types'

type ReferenceTagProps = {
  label: string
  alias?: string
  refType: ReferenceType
  refId: number
  trigger?: string
  versionId?: number
  hint?: ReferencePreviewHint
  loadPreview?: ReferencePreviewLoader
  selected?: boolean
  disabled?: boolean
  className?: string
  usage?: string
  usageOptions?: ReferenceUsageOption[]
  onUsageChange?: (usage: string) => void
  onDelete?: () => void
}

export function ReferenceTag({
  label,
  alias = '',
  refType,
  refId,
  trigger,
  versionId,
  hint,
  loadPreview,
  selected = false,
  disabled = false,
  className,
  usage = '',
  usageOptions = [],
  onUsageChange,
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
      onDelete={disabled ? undefined : onDelete}
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
            data-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled || undefined}
            aria-label={`引用：${displayLabel}${alias ? `，${alias}` : ''}`}
            className={cn(
              'mx-1 inline-flex max-w-[min(22rem,78vw)] cursor-default items-center gap-1.5 rounded-md border border-slate-300/80 bg-slate-100/90 px-2 py-0.5 align-baseline text-[0.9em] leading-6 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors select-none hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700',
              selected && 'border-slate-500 ring-2 ring-slate-400/35',
              className
            )}
          >
            <ReferenceTagIcon kind={kind} url={thumbnail} />
            <span className='truncate'>{displayLabel}</span>
            {alias ? (
              <span className='shrink-0 border-l border-slate-300 pl-1.5 text-[0.78em] font-medium text-slate-500 dark:border-slate-600 dark:text-slate-300'>
                {alias}
              </span>
            ) : null}
            {usageOptions.length > 1 ? (
              <select
                className='reference-tag-usage'
                aria-label={`设置${displayLabel || '引用素材'}用途`}
                value={usage}
                disabled={disabled}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onUsageChange?.(event.target.value)}
              >
                {!usage ? <option value=''>选择用途</option> : null}
                {usageOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
            {onDelete ? (
              <button
                type='button'
                className='reference-tag-delete'
                aria-label={`移除${displayLabel || '引用素材'}`}
                disabled={disabled}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!disabled) {
                    onDelete()
                  }
                }}
              >
                <X aria-hidden='true' />
              </button>
            ) : null}
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
