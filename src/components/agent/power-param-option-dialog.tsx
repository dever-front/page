import { useEffect, useRef, useState } from 'react'
import { Check, ImageOff, Music2, Video } from 'lucide-react'
import { FirstFrameVideo } from '@/components/media/first-frame-video'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { resolveAssetUrl } from '@/lib/request'
import { cn } from '@/lib/utils'

export type ParamPreviewType = 'none' | 'image' | 'audio' | 'video'

export type ParamPreviewOption = {
  id: string | number
  name?: string
  value: string
  native_value?: string
  preview_url?: string
}

type PowerParamOptionDialogProps = {
  open: boolean
  title: string
  previewType: ParamPreviewType
  options: ParamPreviewOption[]
  value: unknown
  disabled?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (value: string) => void
}

export function PowerParamOptionDialog({
  open,
  title,
  previewType,
  options,
  value,
  disabled = false,
  onOpenChange,
  onConfirm,
}: PowerParamOptionDialogProps) {
  const [draftKey, setDraftKey] = useState('')
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>())

  useEffect(() => {
    if (!open) {
      stopAllAudio(audioElementsRef.current)
      return
    }
    const selected = options.find((option) =>
      isParamOptionSelected(option, [String(value ?? '')])
    )
    setDraftKey(selected ? paramPreviewOptionKey(selected) : '')
  }, [open, options, value])

  useEffect(
    () => () => {
      stopAllAudio(audioElementsRef.current)
    },
    []
  )

  const draftOption = options.find(
    (option) => paramPreviewOptionKey(option) === draftKey
  )
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      stopAllAudio(audioElementsRef.current)
    }
    onOpenChange(nextOpen)
  }
  const handleConfirm = () => {
    if (!draftOption || disabled) {
      return
    }
    onConfirm(paramOptionRequestValue(draftOption))
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        layerZIndex={180}
        className='flex max-h-[min(88vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl'
      >
        <DialogHeader className='border-b px-5 py-4 pr-12 sm:px-6'>
          <DialogTitle className='text-base'>{title}</DialogTitle>
          <DialogDescription className='sr-only'>
            选择一个参数选项并确认
          </DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto p-4 sm:p-6'>
          {options.length > 0 ? (
            <div
              className={cn(
                'grid gap-3',
                previewType === 'audio'
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              )}
              role='listbox'
              aria-label={title}
            >
              {options.map((option) => {
                const optionKey = paramPreviewOptionKey(option)
                const selected = optionKey === draftKey
                return (
                  <div
                    key={optionKey}
                    className={cn(
                      'min-w-0 cursor-pointer overflow-hidden rounded-md border bg-background transition-colors',
                      selected
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-foreground/30'
                    )}
                    role='option'
                    aria-selected={selected}
                    onClick={(event) => {
                      if (
                        disabled ||
                        (event.target instanceof Element &&
                          event.target.closest('audio, video, button'))
                      ) {
                        return
                      }
                      setDraftKey(optionKey)
                    }}
                  >
                    <ParamOptionPreviewMedia
                      option={option}
                      previewType={previewType}
                      registerAudio={(element) => {
                        if (element) {
                          audioElementsRef.current.set(optionKey, element)
                        } else {
                          audioElementsRef.current.delete(optionKey)
                        }
                      }}
                      onAudioPlay={(current) =>
                        stopAllAudio(audioElementsRef.current, current)
                      }
                    />
                    <button
                      type='button'
                      className='flex min-h-12 w-full items-center gap-3 border-t px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none'
                      disabled={disabled}
                      onClick={() => setDraftKey(optionKey)}
                    >
                      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                        {paramOptionLabel(option)}
                      </span>
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40 text-transparent'
                        )}
                        aria-hidden='true'
                      >
                        <Check className='size-3.5' />
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className='py-10 text-center text-sm text-muted-foreground'>
              暂无可选项
            </div>
          )}
        </div>

        <DialogFooter className='border-t px-5 py-4 sm:px-6'>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type='button'
            disabled={disabled || !draftOption}
            onClick={handleConfirm}
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ParamOptionPreviewMedia({
  option,
  previewType,
  registerAudio,
  onAudioPlay,
}: {
  option: ParamPreviewOption
  previewType: ParamPreviewType
  registerAudio: (element: HTMLAudioElement | null) => void
  onAudioPlay: (element: HTMLAudioElement) => void
}) {
  const [failed, setFailed] = useState(false)
  const previewURL = resolveAssetUrl(String(option.preview_url || '').trim())

  useEffect(() => {
    setFailed(false)
  }, [previewType, previewURL])

  if (!previewURL || failed) {
    return <ParamOptionPreviewFallback previewType={previewType} />
  }

  switch (previewType) {
    case 'image':
      return (
        <div className='aspect-[4/3] overflow-hidden bg-muted/30'>
          <img
            src={previewURL}
            alt={paramOptionLabel(option)}
            loading='lazy'
            className='size-full object-cover'
            onError={() => setFailed(true)}
          />
        </div>
      )
    case 'audio':
      return (
        <div className='flex h-28 items-center bg-muted/30 px-3'>
          <audio
            ref={registerAudio}
            src={previewURL}
            controls
            preload='none'
            className='w-full min-w-0'
            onError={() => setFailed(true)}
            onPlay={(event) => onAudioPlay(event.currentTarget)}
          />
        </div>
      )
    case 'video':
      return (
        <div className='aspect-video overflow-hidden bg-black'>
          <FirstFrameVideo
            src={previewURL}
            controls
            playsInline
            preload='metadata'
            className='size-full object-contain'
            onError={() => setFailed(true)}
          />
        </div>
      )
    default:
      return <ParamOptionPreviewFallback previewType={previewType} />
  }
}

function ParamOptionPreviewFallback({
  previewType,
}: {
  previewType: ParamPreviewType
}) {
  const Icon =
    previewType === 'audio'
      ? Music2
      : previewType === 'video'
        ? Video
        : ImageOff
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-muted/30 text-muted-foreground',
        previewType === 'audio'
          ? 'h-28'
          : previewType === 'video'
            ? 'aspect-video'
            : 'aspect-[4/3]'
      )}
    >
      <Icon className='size-7' aria-hidden='true' />
    </div>
  )
}

export function normalizeParamPreviewType(value: unknown): ParamPreviewType {
  switch (String(value || '').trim().toLowerCase()) {
    case 'image':
    case 'audio':
    case 'video':
      return String(value).trim().toLowerCase() as ParamPreviewType
    default:
      return 'none'
  }
}

export function paramOptionRequestValue(option: ParamPreviewOption) {
  return (
    String(option.native_value || '').trim() ||
    String(option.value || '').trim() ||
    String(option.name || '').trim() ||
    String(option.id)
  )
}

export function isParamOptionSelected(
  option: ParamPreviewOption,
  values: string[]
) {
  const candidates = [
    String(option.id),
    String(option.native_value || '').trim(),
    String(option.value || '').trim(),
    String(option.name || '').trim(),
  ].filter(Boolean)
  return values.some((value) => candidates.includes(String(value).trim()))
}

function paramPreviewOptionKey(option: ParamPreviewOption) {
  return String(option.id || paramOptionRequestValue(option))
}

function paramOptionLabel(option: ParamPreviewOption) {
  return String(option.name || option.value || option.id).trim()
}

function stopAllAudio(
  elements: Map<string, HTMLAudioElement>,
  except?: HTMLAudioElement
) {
  elements.forEach((element) => {
    if (element === except) {
      return
    }
    element.pause()
    element.currentTime = 0
  })
}
