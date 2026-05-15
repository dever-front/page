import {
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
} from 'react'
import { Loader2, Sparkles, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import {
  createStreamTiming,
  cancelStreamTiming,
  finishStreamTiming,
  markStreamTimingStopping,
  StreamTimingBadge,
  updateStreamTiming,
  updateStreamTimingFromOutput,
  useStreamClock,
  type StreamTiming,
} from '@/page/nodes/show/shared/stream-timing'
import type { AssistantStatusHandler } from '@/lib/assistant/client'
import type { AssistantReferenceFile } from '@/lib/assistant/reference'
import {
  AssistantReferenceList,
  AssistantReferencePicker,
} from './reference-picker'

type AssistantTaskPopoverSubmitInput = {
  instruction: string
  references: AssistantReferenceFile[]
  signal: AbortSignal
  setStatus: AssistantStatusHandler
}

type AssistantTaskPopoverProps = {
  title: string
  description: string
  triggerLabel: string
  initialOpen?: boolean
  triggerClassName?: string
  triggerVariant?: ComponentProps<typeof Button>['variant']
  triggerSize?: ComponentProps<typeof Button>['size']
  iconOnly?: boolean
  hideTriggerIcon?: boolean
  disabled?: boolean
  textareaPlaceholder?: string
  submitLabel?: string
  loadingText?: string
  errorText?: string
  maxReferences?: number
  onSubmit: (input: AssistantTaskPopoverSubmitInput) => Promise<boolean | void>
}

const DEFAULT_MAX_REFERENCES = 4

export function AssistantTaskPopover({
  title,
  description,
  triggerLabel,
  initialOpen = false,
  triggerClassName,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  iconOnly = false,
  hideTriggerIcon = false,
  disabled = false,
  textareaPlaceholder = '可选：输入补充要求、粘贴参考文案，留空则按当前上下文直接生成。',
  submitLabel = '生成',
  loadingText = '正在生成',
  errorText = 'AI 生成失败',
  maxReferences = DEFAULT_MAX_REFERENCES,
  onSubmit,
}: AssistantTaskPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(initialOpen)
  const [instruction, setInstruction] = useState('')
  const [references, setReferences] = useState<AssistantReferenceFile[]>([])
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [timing, setTiming] = useState<StreamTiming | undefined>()
  const now = useStreamClock(running || timing?.status === 'running')

  const handleSubmit = async (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (running) {
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setMessage('')
    setTiming(createStreamTiming(loadingText))
    try {
      const shouldClose = await onSubmit({
        instruction,
        references,
        signal: controller.signal,
        setStatus: (status, detail) => {
          setTiming((current) =>
            detail?.output
              ? updateStreamTimingFromOutput(current, detail.output, status)
              : updateStreamTiming(current, status)
          )
        },
      })
      if (controller.signal.aborted) {
        setMessage('已停止生成')
        setTiming((current) => cancelStreamTiming(current))
        return
      }
      setTiming((current) => finishStreamTiming(current, 'done'))
      if (shouldClose !== false) {
        resetState()
        setOpen(false)
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setMessage('已停止生成')
        setTiming((current) => cancelStreamTiming(current))
        return
      }
      const errorMessage = error instanceof Error ? error.message : errorText
      setMessage(errorMessage)
      setTiming((current) =>
        finishStreamTiming(updateStreamTiming(current, errorMessage), 'failed')
      )
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      setRunning(false)
    }
  }

  const stopSubmit = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!running) {
      return
    }
    abortRef.current?.abort()
    setMessage('正在停止')
    setTiming((current) => markStreamTimingStopping(current))
  }

  const removeReference = (index: number) => {
    setReferences((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && running) {
      setOpen(true)
      return
    }
    setOpen(nextOpen)
    if (!nextOpen) {
      setMessage('')
    }
  }

  const resetState = () => {
    setInstruction('')
    setReferences([])
    setMessage('')
    setTiming(undefined)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          title={triggerLabel}
          className={triggerClassName}
          disabled={disabled && !running}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {hideTriggerIcon ? null : running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {iconOnly ? <span className="sr-only">{triggerLabel}</span> : triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-assistant-layer="true"
        align="end"
        sideOffset={8}
        container={findFloatingLayerContainer(triggerRef.current)}
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        onPointerDown={(event) => event.stopPropagation()}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4" />
            {title}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-3 p-4">
          {timing ? (
            <StreamTimingBadge timing={timing} now={now} className="max-w-full" />
          ) : null}

          <Textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={textareaPlaceholder}
            className="min-h-24 resize-none text-sm"
            disabled={running}
          />

          <AssistantReferenceList
            references={references}
            disabled={running}
            onRemove={removeReference}
          />

          <div className="flex items-center justify-between gap-2">
            <div className="shrink-0">
              <AssistantReferencePicker
                references={references}
                disabled={running}
                maxFiles={maxReferences}
                onReferencesChange={setReferences}
                onMessage={setMessage}
              />
            </div>
            {message ? (
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {message}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={running}
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={disabled && !running}
            onClick={(event) => (running ? stopSubmit(event) : void handleSubmit(event))}
          >
            {running ? <Square className="size-4" /> : <Sparkles className="size-4" />}
            {running ? '停止' : submitLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
