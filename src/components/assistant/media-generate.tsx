import { useRef, useState, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResourcePreviewDialogLazy } from '@/components/resource/lazy-dialogs'
import type {
  AgentInteraction,
  AgentInteractionSubmitResult,
} from '@/lib/agent/types'
import type { Item } from '@/lib/schema'
import type { PageStore } from '@/lib/store'
import { ASSISTANT_DIALOG_LAYER_CLASS } from '@/lib/floating-layer'
import type { ResourceUploadRule } from '@/lib/resource'
import type { UploadFileItem } from '@/lib/upload'
import {
  AssistantMediaInteractionRequiredError,
  assistantMediaKindLabel,
  continueAssistantMediaGeneration,
  resolveAssistantMediaUploadRule,
  resolveAssistantFieldContextFromItem,
  runAssistantMediaGeneration,
  saveAssistantGeneratedMediaItems,
  type AssistantMediaKind,
  type AssistantMediaSurface,
} from '@/lib/assistant/media'
import type { AssistantPageScope } from '@/lib/assistant/registry'
import type { AssistantReferenceFile } from '@/lib/assistant/reference'
import {
  createStreamTiming,
  finishStreamTiming,
  StreamTimingBadge,
  updateStreamTiming,
  updateStreamTimingFromOutput,
  useStreamClock,
  type StreamTiming,
} from '@/components/stream-timing'
import type { AgentStreamStatus } from '@/lib/agent/runner'
import { AssistantInteractionDialog } from './interaction-dialog'
import { AssistantTaskPopover } from './task-popover'

export type AssistantMediaGenerateButtonProps = {
  store: PageStore
  item: Item
  kind: AssistantMediaKind
  surface: AssistantMediaSurface
  uploadRules?: ResourceUploadRule[]
  maxResults?: number
  className?: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  iconOnly?: boolean
  hideTriggerIcon?: boolean
  initialOpen?: boolean
  disabled?: boolean
  scope?: AssistantPageScope
  route?: string
  onGenerated: (items: UploadFileItem[]) => void
}

export function AssistantMediaGenerateButton({
  store,
  item,
  kind,
  surface,
  uploadRules,
  maxResults = 1,
  className,
  variant = 'outline',
  size = 'sm',
  iconOnly = false,
  hideTriggerIcon = false,
  initialOpen = false,
  disabled = false,
  scope = 'modal',
  route,
  onGenerated,
}: AssistantMediaGenerateButtonProps) {
  const pendingRequestRef = useRef<{
    instruction: string
    references: AssistantReferenceFile[]
  } | null>(null)
  const generationTimingRef = useRef<StreamTiming | undefined>()
  const field = resolveAssistantFieldContextFromItem(item)
  const label = assistantMediaKindLabel(kind)
  const uploadRule = resolveAssistantMediaUploadRule(uploadRules, kind)
  const [interactionState, setInteractionState] = useState<{
    error: AssistantMediaInteractionRequiredError
  } | null>(null)
  const [interactionRunning, setInteractionRunning] = useState(false)
  const [previewState, setPreviewState] = useState<{
    items: UploadFileItem[]
    saving: boolean
    regenerating: boolean
    status: string
    timing?: StreamTiming
  } | null>(null)
  const now = useStreamClock(
    interactionRunning ||
      previewState?.regenerating === true ||
      previewState?.saving === true ||
      previewState?.timing?.status === 'running'
  )

  const startGenerationTiming = (status: string) => {
    const timing = createStreamTiming(status)
    generationTimingRef.current = timing
    return timing
  }

  const updateGenerationTiming = (
    status: string,
    detail?: AgentStreamStatus<Record<string, unknown>>
  ) => {
    const timing = detail?.output
      ? updateStreamTimingFromOutput(generationTimingRef.current, detail.output, status)
      : updateStreamTiming(generationTimingRef.current, status)
    generationTimingRef.current = timing
    return timing
  }

  const ensureGenerationTiming = (status: string) => {
    if (generationTimingRef.current?.status === 'running') {
      return updateGenerationTiming(status)
    }
    return startGenerationTiming(status)
  }

  const finishGenerationTiming = (
    status: Exclude<StreamTiming['status'], 'running'>,
    fallbackLabel: string
  ) => {
    const timing =
      generationTimingRef.current || createStreamTiming(fallbackLabel)
    const finished = finishStreamTiming(timing, status)
    generationTimingRef.current = finished
    return finished
  }

  const saveGeneratedMedia = async (generatedItems: UploadFileItem[]) => {
    setPreviewState((current) =>
      current
        ? {
            ...current,
            saving: true,
            status: `正在保存${label}到页面`,
            timing: updateStreamTiming(current.timing, `正在保存${label}到页面`),
          }
        : current
    )
    const savedItems = await saveAssistantGeneratedMediaItems(generatedItems, {
      kind,
      uploadRule,
      maxItems: maxResults,
      onStatus: (status, progress) =>
        setPreviewState((current) =>
          current
            ? {
                ...current,
                status,
                timing: updateStreamTiming(current.timing, status, progress),
              }
            : current
        ),
    })
    if (savedItems.length === 0) {
      setPreviewState((current) =>
        current
          ? {
              ...current,
              saving: false,
              status: `AI 没有返回可用的${label}。`,
              timing: finishStreamTiming(current.timing, 'failed'),
            }
          : current
      )
      toast.error(`AI 没有返回可用的${label}。`)
      return false
    }
    onGenerated(savedItems)
    pendingRequestRef.current = null
    setPreviewState(null)
    toast.success(`已生成${label}`)
    return true
  }

  const showGeneratedPreview = (
    generatedItems: UploadFileItem[],
    status = `${label}已生成，请确认是否使用。`
  ) => {
    setPreviewState({
      items: generatedItems,
      saving: false,
      regenerating: false,
      status,
      timing: finishGenerationTiming('done', status),
    })
  }

  const continueWithInteraction = async (
    current: AssistantMediaInteractionRequiredError,
    result: AgentInteractionSubmitResult,
    setStatus?: (
      status: string,
      detail?: AgentStreamStatus<Record<string, unknown>>
    ) => void,
    signal?: AbortSignal
  ) => {
    const pending = pendingRequestRef.current
    if (!pending || !current || interactionRunning) {
      return false
    }

    setInteractionRunning(true)
    ensureGenerationTiming(`正在继续生成${label}`)
    setPreviewState((currentPreview) =>
      currentPreview
        ? {
            ...currentPreview,
            regenerating: true,
            status: `正在继续生成${label}`,
            timing: updateStreamTiming(currentPreview.timing, `正在继续生成${label}`),
          }
        : currentPreview
    )
    try {
      const generatedItems = await continueAssistantMediaGeneration({
        store,
        scope,
        route,
        field,
        kind,
        surface,
        instruction: pending.instruction,
        references: pending.references,
        uploadRules,
        maxResults,
        interaction: current.interaction,
        interactionText: current.interactionText,
        interactionResult: result,
        signal,
        onStatus: (status, detail) => {
          updateGenerationTiming(status, detail)
          setStatus?.(status, detail)
        },
      })
      if (signal?.aborted) {
        return false
      }
      showGeneratedPreview(generatedItems)
      return true
    } catch (error) {
      if (error instanceof AssistantMediaInteractionRequiredError) {
        setInteractionState({ error })
        return true
      }
      const message =
        error instanceof Error ? error.message : `AI 生成${label}失败`
      generationTimingRef.current = finishGenerationTiming('failed', message)
      setPreviewState((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              status: message,
              timing: generationTimingRef.current,
            }
          : currentPreview
      )
      toast.error(message)
      return false
    } finally {
      setInteractionRunning(false)
      setPreviewState((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              regenerating: false,
            }
          : currentPreview
      )
    }
  }

  const resumeInteraction = async (result: AgentInteractionSubmitResult) => {
    const current = interactionState?.error
    if (!current) {
      return
    }
    setInteractionState(null)
    await continueWithInteraction(current, result)
  }

  const regeneratePreview = async () => {
    const pending = pendingRequestRef.current
    if (!pending || previewState?.regenerating || previewState?.saving) {
      return
    }

    setPreviewState((current) =>
      current
        ? {
            ...current,
            regenerating: true,
            status: `正在重新生成${label}`,
            timing: startGenerationTiming(`正在重新生成${label}`),
          }
        : current
    )

    try {
      const generatedItems = await runAssistantMediaGeneration({
        store,
        scope,
        route,
        field,
        kind,
        surface,
        instruction: pending.instruction,
        references: pending.references,
        uploadRules,
        maxResults,
        onStatus: (status, detail) =>
          setPreviewState((current) =>
            current
              ? {
                  ...current,
                  status,
                  timing: updateGenerationTiming(status, detail),
                }
              : current
          ),
      })
      showGeneratedPreview(generatedItems, `${label}已重新生成，请确认是否使用。`)
    } catch (error) {
      if (error instanceof AssistantMediaInteractionRequiredError) {
        setInteractionState({ error })
      } else {
        toast.error(error instanceof Error ? error.message : `AI 生成${label}失败`)
      }
      setPreviewState((current) =>
        current
          ? {
              ...current,
              regenerating: false,
              timing: finishStreamTiming(current.timing, 'failed'),
            }
          : current
      )
    }
  }

  return (
    <>
      <AssistantTaskPopover
        title={`AI 生成${label}`}
        description={`补充生成要求，或添加参考资料；生成后先预览，确认使用后填入当前${
          surface === 'editor' ? '编辑器' : '上传字段'
        }。`}
        triggerLabel={`AI 生成${label}`}
        initialOpen={initialOpen}
        triggerClassName={className}
        triggerVariant={variant}
        triggerSize={size}
        iconOnly={iconOnly}
        hideTriggerIcon={hideTriggerIcon}
        disabled={disabled || interactionRunning}
        textareaPlaceholder={`可选：描述要生成的${label}内容、风格、比例、时长或用途。留空则按当前页面上下文生成。`}
        loadingText={`正在生成${label}`}
        errorText={`AI 生成${label}失败`}
        onSubmit={async ({ instruction, references, signal, setStatus }) => {
          pendingRequestRef.current = { instruction, references }
          startGenerationTiming(`正在生成${label}`)
          const reportStatus = (
            status: string,
            detail?: AgentStreamStatus<Record<string, unknown>>
          ) => {
            updateGenerationTiming(status, detail)
            setStatus(status, detail)
          }
          try {
            const generatedItems = await runAssistantMediaGeneration({
              store,
              scope,
              route,
              field,
              kind,
              surface,
              instruction,
              references,
              uploadRules,
              maxResults,
              signal,
              onStatus: reportStatus,
            })
            if (signal.aborted) {
              return false
            }
            showGeneratedPreview(generatedItems)
            return true
          } catch (error) {
            if (signal.aborted) {
              return false
            }
            if (error instanceof AssistantMediaInteractionRequiredError) {
              reportStatus(`请确认${label}能力参数。`)
              generationTimingRef.current = undefined
              setInteractionState({ error })
              return true
            }
            generationTimingRef.current = finishGenerationTiming(
              'failed',
              `AI 生成${label}失败`
            )
            throw error
          }
        }}
      />

      <AssistantMediaPreviewDialog
        open={Boolean(previewState)}
        items={previewState?.items || []}
        title={`AI 生成${label}`}
        description="先预览生成结果；点击使用后才会保存到资源库并填入当前控件。"
        status={previewState?.status || ''}
        timing={previewState?.timing}
        now={now}
        busy={previewState?.saving || previewState?.regenerating || interactionRunning}
        onOpenChange={(open) => {
          if (!open && !previewState?.saving && !previewState?.regenerating) {
            pendingRequestRef.current = null
            setPreviewState(null)
          }
        }}
        onUse={() => {
          if (previewState?.items.length) {
            void saveGeneratedMedia(previewState.items)
          }
        }}
        onRegenerate={() => void regeneratePreview()}
      />

      <AssistantInteractionDialog
        open={Boolean(interactionState)}
        interaction={interactionState?.error.interaction as AgentInteraction | undefined}
        title={`补充${label}能力参数`}
        description={
          interactionRunning
            ? `正在继续生成${label}。`
            : `补充这些参数后会继续生成${label}并填入当前控件；如果 AI 已经给出完整参数，会自动继续。`
        }
        disabled={interactionRunning}
        autoSubmitValid
        onOpenChange={(open) => {
          if (!open && !interactionRunning) {
            setInteractionState(null)
          }
        }}
        onSubmit={(result) => void resumeInteraction(result)}
      />
    </>
  )
}

function AssistantMediaPreviewDialog({
  open,
  items,
  title,
  description,
  status,
  timing,
  now,
  busy,
  onOpenChange,
  onUse,
  onRegenerate,
}: {
  open: boolean
  items: UploadFileItem[]
  title: string
  description: string
  status: string
  timing?: StreamTiming
  now: number
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onUse: () => void
  onRegenerate: () => void
}) {
  const visibleStatus = status && status !== timing?.label ? status : ''
  return (
    <ResourcePreviewDialogLazy
      open={open}
      title={title}
      description={description}
      items={items}
      assistantLayer
      layerClassName={ASSISTANT_DIALOG_LAYER_CLASS}
      showDownload={false}
      onOpenChange={onOpenChange}
      footerExtra={
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {timing ? <StreamTimingBadge timing={timing} now={now} /> : null}
            {visibleStatus ? (
              <div className="truncate text-xs text-muted-foreground">{visibleStatus}</div>
            ) : null}
          </div>
        </div>
      }
      renderActions={() => (
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onRegenerate}>
            <RotateCcw className="size-4" />
            重新生成
          </Button>
          <Button type="button" disabled={busy || items.length === 0} onClick={onUse}>
            <Sparkles className="size-4" />
            使用
          </Button>
        </>
      )}
    />
  )
}
