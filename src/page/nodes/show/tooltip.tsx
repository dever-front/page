import { CircleAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import type { NodeItemProps } from '../../nodes'

type HoverTipProps = {
  content?: string
  children: ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  layerZIndex?: number
}

type InlineTipProps = {
  content?: string
  className?: string
  iconClassName?: string
}

export function HoverTip({
  content,
  children,
  className,
  side = 'top',
  sideOffset = 8,
  layerZIndex,
}: HoverTipProps) {
  const text = String(content || '').trim()

  if (!text) {
    return <>{children}</>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className={className}
        style={layerZIndex === undefined ? undefined : { zIndex: layerZIndex }}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

export function InlineTip({ content, className, iconClassName }: InlineTipProps) {
  const text = String(content || '').trim()

  if (!text) {
    return null
  }

  return (
    <HoverTip content={text}>
      <button
        type="button"
        className={cn(
          'inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 cursor-pointer',
          className
        )}
        onClick={(event) => event.preventDefault()}
        aria-label="查看提示"
      >
        <CircleAlert className={cn('size-3.5', iconClassName)} />
      </button>
    </HoverTip>
  )
}

export function ShowTooltip({ item, value }: NodeItemProps) {
  const content = String(value ?? item.tip ?? item.info ?? '').trim()
  return <InlineTip content={content} />
}
