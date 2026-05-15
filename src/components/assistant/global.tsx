import { useState, useSyncExternalStore } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getAssistantRegistryVersion,
  subscribeAssistantRegistry,
} from '@/lib/assistant/registry'
import { AssistantDrawer } from './drawer'

export function GlobalAssistant() {
  const [open, setOpen] = useState(false)

  useSyncExternalStore(
    subscribeAssistantRegistry,
    getAssistantRegistryVersion,
    getAssistantRegistryVersion
  )

  return (
    <>
      <div
        data-assistant-layer="true"
        className="pointer-events-auto fixed bottom-6 right-6 z-[80]"
        onPointerDownCapture={(event) => {
          event.stopPropagation()
          event.nativeEvent.stopImmediatePropagation()
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              onClick={(event) => {
                event.stopPropagation()
                setOpen(true)
              }}
              className="size-12 rounded-full shadow-lg"
            >
              <Bot className="size-5" />
              <span className="sr-only">打开 AI 助理</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="z-[80]">AI 助理</TooltipContent>
        </Tooltip>
      </div>

      <AssistantDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
