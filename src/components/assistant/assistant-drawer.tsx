import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Loader2, Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnergonContentView } from '@/components/energon/content-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  applyAssistantFrontAction,
  extractAssistantFrontActions,
  type AssistantFrontAction,
} from '@/lib/assistant/actions'
import { runAssistantAgent, type AssistantMessage } from '@/lib/assistant/client'
import {
  assistantContextSummary,
  buildAssistantPageContext,
} from '@/lib/assistant/context'
import { getActiveAssistantPage } from '@/lib/assistant/registry'
import { AssistantActionCard } from './assistant-action-card'

type AssistantDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ChatMessage = AssistantMessage & {
  id: string
  actions?: AssistantFrontAction[]
  appliedActionIndexes?: number[]
}

export function AssistantDrawer({ open, onOpenChange }: AssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const activePage = getActiveAssistantPage()
  const pageContext = useMemo(
    () => buildAssistantPageContext(activePage),
    [activePage]
  )
  const contextText = assistantContextSummary(pageContext)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, running])

  const stop = () => {
    abortRef.current?.abort()
  }

  const send = async () => {
    const text = input.trim()
    if (!text || running) {
      return
    }
    const runPageContext = buildAssistantPageContext(getActiveAssistantPage())

    const userMessage: ChatMessage = {
      id: createMessageID(),
      role: 'user',
      content: text,
    }
    const assistantID = createMessageID()
    const assistantMessage: ChatMessage = {
      id: assistantID,
      role: 'assistant',
      content: '',
    }
    const history = messages.map(({ role, content }) => ({ role, content }))

    setMessages((current) => [...current, userMessage, assistantMessage])
    setInput('')
    setRunning(true)
    setStatus('正在思考')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const finalText = await runAssistantAgent({
        text,
        context: runPageContext,
        history,
        signal: controller.signal,
        onDelta: (delta) => {
          setMessages((current) =>
            patchAssistantMessage(current, assistantID, (message) => ({
              ...message,
              content: message.content + delta,
            }))
          )
        },
        onStatus: setStatus,
      })
      const parsed = extractAssistantFrontActions(finalText)
      const visibleText =
        parsed.cleanText ||
        (parsed.actions.length > 0
          ? '我准备好了一个可应用的页面动作。'
          : finalText)
      setMessages((current) =>
        patchAssistantMessage(current, assistantID, (message) => ({
          ...message,
          content: visibleText,
          actions: parsed.actions,
        }))
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 助理请求失败'
      setMessages((current) =>
        patchAssistantMessage(current, assistantID, (item) => ({
          ...item,
          content: message,
        }))
      )
    } finally {
      setRunning(false)
      setStatus('')
      abortRef.current = null
    }
  }

  const applyAction = (messageID: string, index: number, action: AssistantFrontAction) => {
    const registration = getActiveAssistantPage()
    const context = buildAssistantPageContext(registration)
    if (!registration) {
      return
    }
    const applied = applyAssistantFrontAction(registration.store, context, action)
    if (!applied) {
      return
    }
    setMessages((current) =>
      patchAssistantMessage(current, messageID, (message) => ({
        ...message,
        appliedActionIndexes: Array.from(
          new Set([...(message.appliedActionIndexes || []), index])
        ),
      }))
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle>AI 助理</SheetTitle>
              <SheetDescription className="truncate">
                {contextText}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 px-5 py-4">
              {messages.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                  粘贴一段内容，或直接说明你想生成/填入什么。我会基于当前页面字段生成可应用的表单内容。
                </div>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[88%] rounded-md px-3 py-2 text-sm leading-6',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border bg-background'
                    )}
                  >
                    <AssistantMessageContent
                      role={message.role}
                      content={message.content}
                      pending={running}
                    />
                    {message.actions?.map((action, index) => (
                      <AssistantActionCard
                        key={`${message.id}-action-${index}`}
                        action={action}
                        applied={message.appliedActionIndexes?.includes(index)}
                        onApply={() => applyAction(message.id, index, action)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t px-5 py-4">
            {running && status ? (
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {status}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder="输入需求，或粘贴一大段内容让我拆成表单字段..."
                className="min-h-20 resize-none"
                disabled={running}
              />
              <Button
                type="button"
                size="icon"
                className="h-20 shrink-0"
                onClick={running ? stop : () => void send()}
                disabled={!running && !input.trim()}
              >
                {running ? <Square className="size-4" /> : <Send className="size-4" />}
                <span className="sr-only">{running ? '停止' : '发送'}</span>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function patchAssistantMessage(
  messages: ChatMessage[],
  id: string,
  patch: (message: ChatMessage) => ChatMessage
) {
  return messages.map((message) => (message.id === id ? patch(message) : message))
}

function AssistantMessageContent({
  role,
  content,
  pending,
}: {
  role: ChatMessage['role']
  content: string
  pending: boolean
}) {
  if (!content) {
    return pending ? <div className="text-muted-foreground">...</div> : null
  }

  if (role === 'assistant') {
    return (
      <EnergonContentView
        output={{ text: content }}
        emptyText=""
        className="space-y-2"
      />
    )
  }

  return <div className="whitespace-pre-wrap break-words">{content}</div>
}

function createMessageID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
