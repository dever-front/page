import type { ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ReferenceComposerControlTooltip({
  label,
  layerZIndex,
  children,
}: {
  label: string
  layerZIndex?: number
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-flex shrink-0'>{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side='top'
        sideOffset={7}
        style={layerZIndex ? { zIndex: layerZIndex } : undefined}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
