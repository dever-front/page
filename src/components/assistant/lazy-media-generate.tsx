import { lazy, Suspense, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isAssistantAvailable } from '@/lib/assistant/availability'
import type { AssistantMediaGenerateButtonProps } from './media-generate'

const LazyAssistantMediaGenerateButton = lazy(() =>
  import('./media-generate').then((mod) => ({
    default: mod.AssistantMediaGenerateButton,
  }))
)

export function AssistantMediaGenerateLazyButton(
  props: AssistantMediaGenerateButtonProps
) {
  const [loaded, setLoaded] = useState(false)
  const label = `AI 生成${mediaKindLabel(props.kind)}`

  if (!isAssistantAvailable()) {
    return null
  }

  if (loaded) {
    return (
      <Suspense fallback={<AssistantMediaGenerateTrigger {...props} label={label} loading />}>
        <LazyAssistantMediaGenerateButton {...props} initialOpen />
      </Suspense>
    )
  }

  return (
    <AssistantMediaGenerateTrigger
      {...props}
      label={label}
      onClick={() => setLoaded(true)}
    />
  )
}

function mediaKindLabel(kind: AssistantMediaGenerateButtonProps['kind']) {
  if (kind === 'image') return '图片'
  if (kind === 'video') return '视频'
  if (kind === 'audio') return '音频'
  return '文件'
}

function AssistantMediaGenerateTrigger({
  label,
  loading = false,
  onClick,
  className,
  variant = 'outline',
  size = 'sm',
  iconOnly = false,
  hideTriggerIcon = false,
  disabled,
}: AssistantMediaGenerateButtonProps & {
  label: string
  loading?: boolean
  onClick?: () => void
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      title={label}
      className={className}
      disabled={disabled || loading}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick?.()
      }}
    >
      {hideTriggerIcon ? null : loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  )
}
