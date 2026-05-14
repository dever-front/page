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
import { AssistantDrawer } from './assistant-drawer'

export function GlobalAssistant() {
  const [open, setOpen] = useState(false)

  useSyncExternalStore(
    subscribeAssistantRegistry,
    getAssistantRegistryVersion,
    getAssistantRegistryVersion
  )

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-40 size-12 rounded-full shadow-lg"
          >
            <Bot className="size-5" />
            <span className="sr-only">打开 AI 助理</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">AI 助理</TooltipContent>
      </Tooltip>

      <AssistantDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
