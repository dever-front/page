import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
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
import { isAssistantAvailable } from '@/lib/assistant/availability'
import {
  getAssistantFloatingUserKey,
  useAssistantFloatingBlockedByModal,
  useAssistantFloatingEnabled,
} from '@/lib/assistant/floating-state'
import { ASSISTANT_FLOATING_LAYER_CLASS } from '@/lib/floating-layer'
import { useAuthStore } from '@/stores/auth-store'

const AssistantDrawer = lazy(() =>
  import('./drawer').then((module) => ({
    default: module.AssistantDrawer,
  }))
)

export function GlobalAssistant() {
  if (!isAssistantAvailable()) {
    return null
  }

  return <AvailableGlobalAssistant />
}

function AvailableGlobalAssistant() {
  const [open, setOpen] = useState(false)
  const [drawerMounted, setDrawerMounted] = useState(false)
  const user = useAuthStore((state) => state.auth.user)
  const userKey = getAssistantFloatingUserKey(user)
  const enabled = useAssistantFloatingEnabled(userKey)
  const blockedByModal = useAssistantFloatingBlockedByModal()

  useSyncExternalStore(
    subscribeAssistantRegistry,
    getAssistantRegistryVersion,
    getAssistantRegistryVersion
  )

  useEffect(() => {
    if (!enabled || blockedByModal) {
      setOpen(false)
    }
  }, [blockedByModal, enabled])

  if (!enabled || blockedByModal) {
    return null
  }

  return (
    <>
      <div
        data-assistant-layer="true"
        className={`pointer-events-auto fixed bottom-6 right-6 ${ASSISTANT_FLOATING_LAYER_CLASS}`}
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
                setDrawerMounted(true)
                setOpen(true)
              }}
              className="size-12 rounded-full shadow-lg"
            >
              <Bot className="size-5" />
              <span className="sr-only">打开 AI 助理</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className={ASSISTANT_FLOATING_LAYER_CLASS}>
            AI 助理
          </TooltipContent>
        </Tooltip>
      </div>

      {drawerMounted ? (
        <Suspense fallback={null}>
          <AssistantDrawer open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  )
}
