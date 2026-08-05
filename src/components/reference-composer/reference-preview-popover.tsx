import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Check, ExternalLink, FileText, Loader2, Trash2 } from 'lucide-react'
import { FirstFrameVideo } from '@/components/media/first-frame-video'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ContentView } from '@/components/energon/content-view'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import type {
  ReferencePreview,
  ReferencePreviewHint,
  ReferencePreviewLoader,
  ReferencePreviewMedia,
  ReferenceType,
} from './types'
import { loadReferencePreview } from './reference-preview-cache'

const CLOSE_DELAY = 140
const GENERIC_MEDIA_DESCRIPTIONS: Record<string, string> = {
  image: '图片内容',
  video: '视频内容',
  audio: '音频内容',
  file: '文件内容',
}

type ReferencePreviewPopoverProps = {
  label: string
  refType: ReferenceType
  refId: number
  trigger?: string
  versionId?: number
  hint?: ReferencePreviewHint
  loadPreview?: ReferencePreviewLoader
  openDelay?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  avoidCollisions?: boolean
  triggerClassName?: string
  hoverOnly?: boolean
  selectedMediaURL?: string
  selectedMediaIndex?: number
  mediaCapacity?: number
  onMediaSelect?: (url: string, index: number, count: number) => void
  onDelete?: () => void
  children: ReactNode | ((preview?: ReferencePreview) => ReactNode)
}

export function ReferencePreviewPopover({
  label,
  refType,
  refId,
  trigger,
  versionId,
  hint,
  loadPreview,
  openDelay = 0,
  side = 'top',
  align = 'start',
  avoidCollisions = true,
  triggerClassName,
  hoverOnly = false,
  selectedMediaURL = '',
  selectedMediaIndex = 0,
  mediaCapacity = 0,
  onMediaSelect,
  onDelete,
  children,
}: ReferencePreviewPopoverProps) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ReferencePreview>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const previewRequest = useRef<Promise<ReferencePreview> | undefined>(
    undefined
  )

  useEffect(() => {
    previewRequest.current = undefined
    setPreview(undefined)
    setLoading(false)
    setError('')
  }, [refId, refType, versionId])

  useEffect(
    () => () => {
      clearTimer(openTimer)
      clearTimer(closeTimer)
    },
    []
  )

  const requestPreview = () => {
    if (!loadPreview || preview || previewRequest.current) {
      return
    }
    setLoading(true)
    setError('')
    const pending = loadReferencePreview(loadPreview, {
      refType,
      refId,
      label,
      trigger,
      versionId,
    })
    previewRequest.current = pending
    void pending
      .then(setPreview)
      .catch((currentError: unknown) => {
        previewRequest.current = undefined
        setError(errorText(currentError))
      })
      .finally(() => setLoading(false))
  }

  const showPreview = () => {
    clearTimer(openTimer)
    clearTimer(closeTimer)
    setOpen(true)
    requestPreview()
  }

  const schedulePreview = () => {
    clearTimer(closeTimer)
    if (open || openTimer.current != null) {
      return
    }
    if (openDelay <= 0) {
      showPreview()
      return
    }
    openTimer.current = window.setTimeout(showPreview, openDelay)
  }

  const scheduleClose = () => {
    clearTimer(openTimer)
    clearTimer(closeTimer)
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY)
  }

  const deleteReference = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    clearTimer(openTimer)
    clearTimer(closeTimer)
    setOpen(false)
    onDelete?.()
  }

  const previewTitle = preview?.title || label
  const previewText =
    preview?.text.trim() || (!loadPreview ? hint?.text?.trim() : '')
  const previewMedia = preview?.media || []
  const previewKind = previewMedia[0]?.kind || hint?.kind || ''
  const bodyText =
    isRepeatedPreviewText(previewText, previewTitle, label) ||
    isGenericMediaDescription(previewText, previewKind)
      ? ''
      : previewText
  const previewContent = preview?.content
  const hasPreviewContent = hasReferencePreviewContent(previewContent)
  const kind = referencePreviewKind(refType, hint, preview)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          if (hoverOnly) {
            return
          }
          showPreview()
          return
        }
        setOpen(false)
      }}
    >
      <PopoverTrigger asChild>
        <span
          ref={triggerRef}
          className={triggerClassName}
          onPointerEnter={schedulePreview}
          onPointerLeave={scheduleClose}
          onFocus={schedulePreview}
          onBlur={scheduleClose}
        >
          {typeof children === 'function' ? children(preview) : children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        container={findFloatingLayerContainer(triggerRef.current)}
        side={side}
        align={align}
        sideOffset={8}
        avoidCollisions={avoidCollisions}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={() => {
          clearTimer(closeTimer)
          clearTimer(openTimer)
        }}
        onPointerLeave={scheduleClose}
        className='z-[2200] w-[min(400px,calc(100vw-24px))] overflow-hidden overscroll-contain rounded-lg border-slate-200 bg-white p-0 text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
      >
        <div className='relative flex min-h-12 items-center border-b border-slate-200 py-3 pr-12 pl-4 text-left dark:border-slate-700'>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-sm font-semibold'>{previewTitle}</div>
            <div className='mt-0.5 text-xs text-slate-500 dark:text-slate-400'>
              {referenceKindLabel(refType, kind)}
            </div>
          </div>
          {onDelete ? (
            <button
              type='button'
              title='删除引用'
              aria-label='删除引用'
              className='absolute top-1/2 right-3 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-400/45 focus-visible:outline-none dark:hover:bg-red-950/45 dark:hover:text-red-400'
              onMouseDown={(event) => event.preventDefault()}
              onClick={deleteReference}
            >
              <Trash2 className='size-4' />
            </button>
          ) : null}
        </div>
        {loading ? (
          <div className='flex min-h-28 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400'>
            <Loader2 className='size-4 animate-spin' />
            正在加载引用内容
          </div>
        ) : error ? (
          <div className='px-4 py-6 text-center text-sm text-red-600 dark:text-red-400'>
            {error}
          </div>
        ) : hasPreviewContent || bodyText || previewMedia.length > 0 ? (
          <ReferencePreviewBody
            text={bodyText}
            media={previewMedia}
            content={previewContent}
            selectedMediaURL={selectedMediaURL}
            selectedMediaIndex={selectedMediaIndex}
            mediaCapacity={mediaCapacity}
            onMediaSelect={onMediaSelect}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function referencePreviewKind(
  refType: ReferenceType,
  hint?: ReferencePreviewHint,
  preview?: ReferencePreview
) {
  return (
    preview?.media[0]?.kind ||
    hint?.kind ||
    (refType === 'message' || refType === 'session' ? refType : 'file')
  )
}

function ReferencePreviewBody({
  text,
  media,
  content,
  selectedMediaURL,
  selectedMediaIndex,
  mediaCapacity,
  onMediaSelect,
}: {
  text?: string
  media: ReferencePreviewMedia[]
  content?: unknown
  selectedMediaURL?: string
  selectedMediaIndex?: number
  mediaCapacity?: number
  onMediaSelect?: (url: string, index: number, count: number) => void
}) {
  if (hasReferencePreviewContent(content)) {
    return (
      <div className='max-h-[min(420px,62vh)] overflow-y-auto overscroll-contain px-4 py-4 text-left'>
        <ContentView
          output={content}
          emptyText=''
          mediaLayout='chat'
          className='break-words [overflow-wrap:anywhere] [&_img]:mx-auto [&_video]:mx-auto'
        />
      </div>
    )
  }
  const selectionRequired =
    Number(mediaCapacity || 0) > 0 && media.length > Number(mediaCapacity || 0)
  return (
    <div className='max-h-[min(420px,62vh)] overflow-y-auto overscroll-contain'>
      {media.length > 0 ? (
        <div className='border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50'>
          {onMediaSelect && media.length > 1 ? (
            <div className='flex items-center justify-between gap-3 px-4 pt-3 text-xs text-slate-600 dark:text-slate-300'>
              <span>
                {selectionRequired ? '请选择具体素材' : '可选择具体素材'}
              </span>
              {!selectionRequired &&
              (selectedMediaURL || Number(selectedMediaIndex || 0) > 0) ? (
                <button
                  type='button'
                  className='rounded-md px-2 py-1 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'
                  onClick={() => onMediaSelect('', 0, media.length)}
                >
                  使用全部
                </button>
              ) : null}
            </div>
          ) : null}
          <div className='flex flex-wrap items-center justify-center gap-3 p-4'>
            {media.map((item, index) => {
              const mediaIndex = Number(item.index || 0) || index + 1
              const selected =
                (selectedMediaURL && item.url === selectedMediaURL) ||
                (!selectedMediaURL &&
                  Number(selectedMediaIndex || 0) === mediaIndex)
              return (
                <div
                  key={`${item.refType || item.kind}-${item.refId || 0}-${item.url}-${index}`}
                  className='relative'
                >
                  <ReferencePreviewMediaView
                    media={item}
                    compact={media.length > 1}
                  />
                  {onMediaSelect && media.length > 1 ? (
                    <button
                      type='button'
                      aria-label={`选择${item.label || `第 ${mediaIndex} 项素材`}`}
                      aria-pressed={selected}
                      className={`absolute inset-0 rounded-md border-2 transition-colors ${
                        selected
                          ? 'border-emerald-600 bg-emerald-950/10'
                          : 'border-transparent hover:border-emerald-500/70'
                      }`}
                      onClick={() =>
                        onMediaSelect(item.url, mediaIndex, media.length)
                      }
                    >
                      <span className='sr-only'>选择第 {mediaIndex} 项素材</span>
                      {selected ? (
                        <span className='absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-emerald-700 text-white shadow'>
                          <Check className='size-4' />
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      {text ? (
        <div className='px-4 py-4 text-left'>
          <ContentView
            output={text}
            emptyText=''
            className='space-y-2 break-words [overflow-wrap:anywhere] [&_img]:mx-auto [&_video]:mx-auto'
          />
        </div>
      ) : null}
    </div>
  )
}

function hasReferencePreviewContent(content: unknown) {
  return Array.isArray(content) ? content.length > 0 : content != null
}

function ReferencePreviewMediaView({
  media,
  compact,
}: {
  media: ReferencePreviewMedia
  compact: boolean
}) {
  if (media.kind === 'image') {
    return (
      <a
        href={media.url}
        target='_blank'
        rel='noreferrer'
        title={media.label}
        className={
          compact
            ? 'flex w-[156px] max-w-full justify-center'
            : 'flex w-full max-w-[280px] justify-center'
        }
      >
        <img
          src={media.url}
          alt={media.label}
          loading='lazy'
          decoding='async'
          className='max-h-[280px] max-w-full rounded-md object-contain'
        />
      </a>
    )
  }
  if (media.kind === 'video') {
    return (
      <FirstFrameVideo
        src={media.url}
        controls
        preload='metadata'
        className={
          compact
            ? 'w-[168px] max-w-full rounded-md'
            : 'w-full max-w-[340px] rounded-md'
        }
      />
    )
  }
  if (media.kind === 'audio') {
    return (
      <audio
        src={media.url}
        controls
        preload='metadata'
        className='w-full max-w-[340px]'
      />
    )
  }
  return (
    <a
      href={media.url}
      target='_blank'
      rel='noreferrer'
      className='flex w-full max-w-[320px] items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-center text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
    >
      <FileText className='size-4 shrink-0' />
      <span className='min-w-0 truncate'>{media.label}</span>
      <ExternalLink className='size-3.5 shrink-0' />
    </a>
  )
}

function referenceKindLabel(refType: ReferenceType, kind: string) {
  if (kind === 'image') return '图片'
  if (kind === 'video') return '视频'
  if (kind === 'audio') return '音频'
  if (refType === 'message') return '消息'
  if (refType === 'session') return '会话'
  return '文件'
}

function isRepeatedPreviewText(
  text: string | undefined,
  title: string,
  label: string
) {
  const normalizedText = normalizePreviewText(text)
  if (!normalizedText) {
    return false
  }
  return (
    normalizedText === normalizePreviewText(title) ||
    normalizedText === normalizePreviewText(label)
  )
}

function isGenericMediaDescription(text: string | undefined, kind: string) {
  return normalizePreviewText(text) === GENERIC_MEDIA_DESCRIPTIONS[kind]
}

function normalizePreviewText(value: string | undefined) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clearTimer(timer: { current: number | undefined }) {
  if (timer.current == null) {
    return
  }
  window.clearTimeout(timer.current)
  timer.current = undefined
}

function errorText(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : '引用内容加载失败'
}
