import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bot, ClipboardList, Loader2, Send, Sparkles, Square } from 'lucide-react'
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
  type AssistantPermissionContext,
  type AssistantFrontAction,
} from '@/lib/assistant/actions'
import { runAssistantAgent, type AssistantMessage } from '@/lib/assistant/client'
import type { AgentStreamStatus } from '@/lib/agent/runner'
import {
  assistantContextSummary,
  buildAssistantPageContext,
} from '@/lib/assistant/context'
import {
  getActiveAssistantPage,
  getAssistantRegistryVersion,
  subscribeAssistantRegistry,
} from '@/lib/assistant/registry'
import {
  buildAssistantReferenceMessage,
  type AssistantReferenceFile,
} from '@/lib/assistant/reference'
import { loadAssistantPermissionContextSafe } from '@/lib/assistant/permission'
import {
  buildAssistantFormFillTask,
  mergeAssistantTaskReferences,
} from '@/lib/assistant/task'
import {
  cancelStreamTiming,
  createStreamTiming,
  finishStreamTiming,
  markStreamTimingStopping,
  StreamTimingBadge,
  updateStreamTiming,
  updateStreamTimingFromOutput,
  useStreamClock,
  type StreamTimingStatus,
  type StreamTiming,
} from '@/page/nodes/show/shared/stream-timing'
import { AssistantActionCard } from './action-card'
import {
  AssistantReferenceList,
  AssistantReferencePicker,
} from './reference-picker'

type AssistantDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ChatMessage = AssistantMessage & {
  id: string
  output?: Record<string, unknown>
  actions?: AssistantFrontAction[]
  appliedActionIndexes?: number[]
}

type SendOptions = {
  text?: string
  task?: Record<string, unknown>
  clearInput?: boolean
}

export function AssistantDrawer({ open, onOpenChange }: AssistantDrawerProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [references, setReferences] = useState<AssistantReferenceFile[]>([])
  const [referenceMessage, setReferenceMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [timing, setTiming] = useState<StreamTiming | undefined>()
  const [permissionContext, setPermissionContext] =
    useState<AssistantPermissionContext | null>(null)
  const [permissionLoading, setPermissionLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const registryVersion = useSyncExternalStore(
    subscribeAssistantRegistry,
    getAssistantRegistryVersion,
    getAssistantRegistryVersion
  )
  const activePage = useMemo(
    () => getActiveAssistantPage(),
    [registryVersion, open]
  )
  const pageContext = useMemo(
    () => buildAssistantPageContext(activePage),
    [activePage, registryVersion]
  )
  const contextText = assistantContextSummary(pageContext)
  const now = useStreamClock(running || timing?.status === 'running')

  const updateRunStatus = (
    nextStatus: string,
    detail?: AgentStreamStatus<Record<string, unknown>>
  ) => {
    setStatus(nextStatus)
    setTiming((current) =>
      detail?.output
        ? updateStreamTimingFromOutput(current, detail.output, nextStatus)
        : updateStreamTiming(current, nextStatus)
    )
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, running])

  useEffect(() => {
    if (!open || permissionContext || permissionLoading) {
      return
    }

    let cancelled = false
    setPermissionLoading(true)
    loadAssistantPermissionContextSafe()
      .then((result) => {
        if (!cancelled) {
          setPermissionContext(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissionContext({ menu: [], entry: '', permissions: [] })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPermissionLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, permissionContext, permissionLoading])

  const stop = () => {
    abortRef.current?.abort()
    setStatus('正在停止')
    setTiming((current) => markStreamTimingStopping(current))
  }

  const send = async (options: SendOptions = {}) => {
    const runReferences = references
    const text =
      (options.text ?? input).trim() ||
      (runReferences.length > 0 ? '请根据参考资料和当前上下文进行分析。' : '')
    if (!text || running) {
      return
    }
    const runPageContext = buildAssistantPageContext(getActiveAssistantPage())
    const runPermissionContext = await ensurePermissionContext(
      permissionContext,
      setPermissionContext,
      setPermissionLoading
    )

    const userMessage: ChatMessage = {
      id: createMessageID(),
      role: 'user',
      content: buildAssistantReferenceMessage(text, runReferences),
    }
    const assistantID = createMessageID()
    const assistantMessage: ChatMessage = {
      id: assistantID,
      role: 'assistant',
      content: '',
    }
    const history = messages.map(({ role, content }) => ({ role, content }))

    setMessages((current) => [...current, userMessage, assistantMessage])
    if (options.clearInput ?? options.text == null) {
      setInput('')
    }
    if (runReferences.length > 0) {
      setReferences([])
      setReferenceMessage('')
    }
    setRunning(true)
    setStatus('正在思考')
    setTiming(createStreamTiming('正在思考'))

    const controller = new AbortController()
    abortRef.current = controller
    let finishStatus: Exclude<StreamTimingStatus, 'running'> = 'done'

    try {
      let finalOutput: Record<string, unknown> = {}
      const finalText = await runAssistantAgent({
        text,
        task: mergeAssistantTaskReferences(options.task, runReferences),
        context: runPageContext,
        permissionContext: runPermissionContext,
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
        onStatus: updateRunStatus,
        onFinalOutput: (output) => {
          finalOutput = output
        },
      })
      if (controller.signal.aborted) {
        return
      }
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
          output: buildAssistantMessageOutput(finalOutput, visibleText),
          actions: parsed.actions,
        }))
      )
      const autoAppliedIndexes = await applyActionsFromCurrentPage(
        parsed.actions,
        runPermissionContext,
        updateRunStatus
      )
      if (autoAppliedIndexes.length > 0) {
        setMessages((current) =>
          patchAssistantMessage(current, assistantID, (message) => ({
            ...message,
            appliedActionIndexes: Array.from(
              new Set([
                ...(message.appliedActionIndexes || []),
                ...autoAppliedIndexes,
              ])
            ),
          }))
        )
      }
    } catch (error) {
      finishStatus = 'failed'
      const message = error instanceof Error ? error.message : 'AI 助理请求失败'
      setMessages((current) =>
        patchAssistantMessage(current, assistantID, (item) => ({
          ...item,
          content: message,
        }))
      )
    } finally {
      if (controller.signal.aborted) {
        finishStatus = 'canceled'
      }
      setTiming((current) =>
        finishStatus === 'canceled'
          ? cancelStreamTiming(current)
          : finishStreamTiming(current, finishStatus)
      )
      setRunning(false)
      setStatus('')
      abortRef.current = null
    }
  }

  const fillCurrentForm = () => {
    void send({
      text: '请根据当前表单上下文生成并填写当前表单；已有内容可以在保持业务语义的前提下优化重写。',
      task: buildAssistantFormFillTask({ mode: 'form', overwrite: true }),
      clearInput: false,
    })
  }

  const parseInputToForm = () => {
    const sourceText = input.trim()
    if (!sourceText) {
      return
    }

    void send({
      text: `请解析下面内容并填入当前表单：\n${sourceText}`,
      task: buildAssistantFormFillTask({
        mode: 'paste',
        sourceText,
        overwrite: true,
      }),
      clearInput: true,
    })
  }

  const applyAction = async (
    messageID: string,
    index: number,
    action: AssistantFrontAction
  ) => {
    const runPermissionContext = await ensurePermissionContext(
      permissionContext,
      setPermissionContext,
      setPermissionLoading
    )
    const applied = await applySingleActionFromCurrentPage(
      action,
      runPermissionContext
    )
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

  const applySingleActionFromCurrentPage = async (
    action: AssistantFrontAction,
    runPermissionContext: AssistantPermissionContext
  ) => {
    const registration = getActiveAssistantPage()
    const context = buildAssistantPageContext(registration)
    return await applyAssistantFrontAction(
      {
        registration,
        context,
        permissionContext: runPermissionContext,
        navigate: (target) => navigate({ to: target.to, search: target.search }),
      },
      action
    )
  }

  const applyActionsFromCurrentPage = async (
    actions: AssistantFrontAction[],
    runPermissionContext: AssistantPermissionContext,
    onStatus: (status: string) => void
  ) => {
    const appliedIndexes: number[] = []
    for (const [index, action] of actions.entries()) {
      onStatus('正在执行页面动作')
      const applied = await applySingleActionFromCurrentPage(
        action,
        runPermissionContext
      )
      if (applied) {
        appliedIndexes.push(index)
      }
    }
    return appliedIndexes
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-assistant-layer="true"
        layerClassName="z-[90]"
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        showCloseButton
      >
        <div
          data-assistant-layer="true"
          className="flex min-h-0 flex-1 flex-col"
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
                    直接说你想打开哪个页面、录入什么内容，或粘贴一段材料。我会基于当前页面和你的后台权限自动打开页面、填入字段；最终保存仍由你手动确认。
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
                        'min-w-0 max-w-[92%] overflow-hidden rounded-md px-3 py-2 text-sm leading-6',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'border bg-background'
                      )}
                    >
                      <AssistantMessageContent
                        role={message.role}
                        content={message.content}
                        output={message.output}
                        pending={running}
                      />
                      {message.actions?.map((action, index) => (
                        <AssistantActionCard
                          key={`${message.id}-action-${index}`}
                          action={action}
                          applied={message.appliedActionIndexes?.includes(index)}
                          onApply={() => void applyAction(message.id, index, action)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="border-t px-5 py-4">
              {timing ? (
                <div className="mb-2">
                  <StreamTimingBadge timing={timing} now={now} />
                </div>
              ) : running && status ? (
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  {status}
                </div>
              ) : null}
              {references.length > 0 ? (
                <div className="mb-2">
                  <AssistantReferenceList
                    references={references}
                    disabled={running}
                    onRemove={(index) =>
                      setReferences((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index)
                      )
                    }
                  />
                </div>
              ) : null}
              {referenceMessage ? (
                <div className="mb-2 truncate text-xs text-muted-foreground">
                  {referenceMessage}
                </div>
              ) : null}
              <div className="flex gap-2">
                <div className="min-w-0 flex-1 space-y-2">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <AssistantReferencePicker
                      references={references}
                      disabled={running}
                      onReferencesChange={setReferences}
                      onMessage={setReferenceMessage}
                    />
                    {pageContext?.form?.fields.length ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={fillCurrentForm}
                          disabled={running}
                        >
                          <Sparkles className="size-3.5" />
                          AI 填写当前表单
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={parseInputToForm}
                          disabled={running || !input.trim()}
                        >
                          <ClipboardList className="size-3.5" />
                          解析填表
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="h-20 shrink-0"
                  onClick={running ? stop : () => void send()}
                  disabled={!running && !input.trim() && references.length === 0}
                >
                  {running ? <Square className="size-4" /> : <Send className="size-4" />}
                  <span className="sr-only">{running ? '停止' : '发送'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

async function ensurePermissionContext(
  current: AssistantPermissionContext | null,
  setPermissionContext: (context: AssistantPermissionContext) => void,
  setPermissionLoading: (loading: boolean) => void
) {
  if (current) {
    return current
  }

  setPermissionLoading(true)
  const next = await loadAssistantPermissionContextSafe()
  setPermissionContext(next)
  setPermissionLoading(false)
  return next
}

function patchAssistantMessage(
  messages: ChatMessage[],
  id: string,
  patch: (message: ChatMessage) => ChatMessage
) {
  return messages.map((message) => (message.id === id ? patch(message) : message))
}

function buildAssistantMessageOutput(
  output: Record<string, unknown>,
  text: string
) {
  if (Object.keys(output || {}).length === 0) {
    return undefined
  }
  return {
    ...output,
    text,
  }
}

function AssistantMessageContent({
  role,
  content,
  output,
  pending,
}: {
  role: ChatMessage['role']
  content: string
  output?: ChatMessage['output']
  pending: boolean
}) {
  if (!content && !output) {
    return pending ? <div className="text-muted-foreground">...</div> : null
  }

  if (role === 'assistant') {
    return (
      <EnergonContentView
        output={output || { text: content }}
        emptyText=""
        className="space-y-2 break-words [overflow-wrap:anywhere]"
      />
    )
  }

  return <div className="whitespace-pre-wrap break-all">{content}</div>
}

function createMessageID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
