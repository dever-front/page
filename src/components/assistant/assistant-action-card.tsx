import { Check, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  assistantActionPreview,
  assistantActionSummary,
  type AssistantFrontAction,
} from '@/lib/assistant/actions'

type AssistantActionCardProps = {
  action: AssistantFrontAction
  applied?: boolean
  onApply: () => void
}

export function AssistantActionCard({
  action,
  applied,
  onApply,
}: AssistantActionCardProps) {
  return (
    <div className="mt-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="size-4 shrink-0" />
            <span className="truncate">{assistantActionSummary(action)}</span>
          </div>
          <Badge variant="outline" className="mt-2">
            {action.type === 'fill_form' ? '填入字段' : '批量填表'}
          </Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant={applied ? 'outline' : 'default'}
          disabled={applied}
          onClick={onApply}
          className="shrink-0"
        >
          {applied ? <Check className="size-4" /> : null}
          {applied ? '已应用' : '应用'}
        </Button>
      </div>
      <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 text-xs leading-5 text-muted-foreground">
        {assistantActionPreview(action)}
      </pre>
    </div>
  )
}
