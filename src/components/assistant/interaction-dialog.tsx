import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AgentInteractionPanel,
  type AgentInteraction,
  type AgentInteractionSubmitResult,
} from '@/page/nodes/show/agent-interaction-panel'
import { streamValueText } from '@/lib/stream'

type AssistantInteractionDialogProps = {
  open: boolean
  interaction?: AgentInteraction
  title?: string
  description?: string
  disabled?: boolean
  readonly?: boolean
  initialData?: Record<string, unknown>
  autoSubmitValid?: boolean
  paramApi?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (result: AgentInteractionSubmitResult) => void
}

export function AssistantInteractionDialog({
  open,
  interaction,
  title,
  description,
  disabled,
  readonly,
  initialData,
  autoSubmitValid,
  paramApi,
  onOpenChange,
  onSubmit,
}: AssistantInteractionDialogProps) {
  if (!interaction) {
    return null
  }

  const dialogTitle =
    title || streamValueText(interaction.title) || '补充交互信息'
  const dialogDescription =
    description ||
    streamValueText(interaction.description) ||
    (readonly
      ? '已提交的交互信息，只读查看。'
      : '填写这些参数后，AI 助理会继续执行当前任务。')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant-layer="true"
        layerClassName="z-[95]"
        className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b px-5 py-4 text-start">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-hidden">
          <AgentInteractionPanel
            interaction={interaction}
            paramApi={paramApi}
            readonly={readonly}
            initialData={initialData}
            autoSubmitValid={autoSubmitValid}
            disabled={disabled}
            layout="dialog"
            hideHeader
            onSubmit={readonly ? undefined : onSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
