import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
  type AssistantPermissionContext,
  type AssistantFrontAction,
} from '@/lib/assistant/actions'
import { runAssistantAgent, type AssistantMessage } from '@/lib/assistant/client'
import type {
  AgentInteraction,
  AgentInteractionSubmitResult,
} from '@/lib/agent/types'
import type { AgentStreamStatus } from '@/lib/agent/runner'
import {
  assistantContextSummary,
  buildAssistantPageContext,
} from '@/lib/assistant/context'
import {
  buildAssistantInteractionInput,
  normalizeAssistantInteraction,
} from '@/lib/assistant/interaction'
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
import { mergeAssistantTaskReferences } from '@/lib/assistant/task'
import { stripRouterBasePath } from '@/lib/router-path'
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
} from '@/components/stream-timing'
import { AssistantActionCard } from './action-card'
import {
  AssistantReferenceList,
  AssistantReferencePicker,
} from './reference-picker'
import { AssistantInteractionDialog } from './interaction-dialog'

type AssistantDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ChatMessage = AssistantMessage & {
  id: string
  output?: Record<string, unknown>
  actions?: AssistantFrontAction[]
  appliedActionIndexes?: number[]
  interaction?: AgentInteraction
  interactionAnswered?: boolean
  interactionData?: Record<string, unknown>
  kind?: 'chat' | 'interaction_result'
  data?: Record<string, unknown>
}

type SendOptions = {
  text?: string
  input?: Record<string, unknown>
  task?: Record<string, unknown>
  clearInput?: boolean
  messageKind?: ChatMessage['kind']
  messageData?: Record<string, unknown>
  answeredInteractionMessageID?: string
  answeredInteractionData?: Record<string, unknown>
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
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false)
  const [interactionDialogMessageID, setInteractionDialogMessageID] =
    useState('')
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
  const pendingInteractionMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === 'assistant' &&
            message.interaction &&
            !message.interactionAnswered
        ),
    [messages]
  )
  const interactionDialogMessage = useMemo(() => {
    if (!interactionDialogMessageID) {
      return pendingInteractionMessage
    }
    return (
      messages.find(
        (message) =>
          message.id === interactionDialogMessageID &&
          message.role === 'assistant' &&
          Boolean(message.interaction)
      ) || pendingInteractionMessage
    )
  }, [interactionDialogMessageID, messages, pendingInteractionMessage])
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
    if (pendingInteractionMessage?.id) {
      setInteractionDialogMessageID(pendingInteractionMessage.id)
      setInteractionDialogOpen(true)
    }
  }, [pendingInteractionMessage?.id])

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

  const changeInteractionDialogOpen = (nextOpen: boolean) => {
    setInteractionDialogOpen(nextOpen)
    if (!nextOpen) {
      setInteractionDialogMessageID('')
    }
  }

  const openInteractionDialog = (messageID: string) => {
    setInteractionDialogMessageID(messageID)
    setInteractionDialogOpen(true)
  }

  const submitInteraction = async (result: AgentInteractionSubmitResult) => {
    const sourceMessage = interactionDialogMessage
    if (
      !sourceMessage?.interaction ||
      sourceMessage.interactionAnswered ||
      running
    ) {
      return
    }

    setInteractionDialogOpen(false)
    setInteractionDialogMessageID('')

    await send({
      text: result.text,
      input: buildAssistantInteractionInput(sourceMessage.interaction, result),
      clearInput: false,
      messageKind: 'interaction_result',
      messageData: result.data,
      answeredInteractionMessageID: sourceMessage.id,
      answeredInteractionData: result.data,
    })
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
      type: options.messageKind,
      kind: options.messageKind,
      data: options.messageData,
    }
    const assistantID = createMessageID()
    const assistantMessage: ChatMessage = {
      id: assistantID,
      role: 'assistant',
      content: '',
    }
    const history = buildAssistantHistory(messages)

    setMessages((current) => {
      const next = options.answeredInteractionMessageID
        ? current.map((message) =>
            message.id === options.answeredInteractionMessageID
              ? {
                  ...message,
                  interactionAnswered: true,
                  interaction_answered: true,
                  interactionData: options.answeredInteractionData,
                  interaction_data: options.answeredInteractionData,
                }
              : message
          )
        : current
      return [...next, userMessage, assistantMessage]
    })
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
        input: options.input,
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
      const interaction = normalizeAssistantInteraction(finalOutput)
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
          actions: interaction ? [] : parsed.actions,
          interaction,
          interactionAnswered: false,
          interaction_answered: false,
        }))
      )
      if (interaction) {
        updateRunStatus('等待补充信息')
        return
      }
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
        navigate: (target) =>
          navigate({
            to: stripRouterBasePath(target.to),
            search: target.search,
          }),
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
                      {message.interaction ? (
                        <AssistantInteractionNotice
                          answered={Boolean(message.interactionAnswered)}
                          summary={summarizeSubmittedInteraction(
                            message.interactionData
                          )}
                          disabled={running && !message.interactionAnswered}
                          onOpen={() => openInteractionDialog(message.id)}
                        />
                      ) : null}
                      {message.role === 'assistant' && !message.interaction ? (
                        <AssistantSuggestionChoices
                          content={message.content}
                          disabled={running}
                          onSelect={(choice) =>
                            void send({ text: choice.prompt })
                          }
                        />
                      ) : null}
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
                    placeholder="输入需求、修改要求，或粘贴材料让我处理当前页面..."
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
      <AssistantInteractionDialog
        open={
          Boolean(interactionDialogMessage?.interaction) &&
          interactionDialogOpen
        }
        interaction={interactionDialogMessage?.interaction}
        readonly={Boolean(interactionDialogMessage?.interactionAnswered)}
        initialData={interactionDialogMessage?.interactionData}
        autoSubmitValid
        disabled={running}
        onOpenChange={changeInteractionDialogOpen}
        onSubmit={(result) => void submitInteraction(result)}
      />
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

function buildAssistantHistory(messages: ChatMessage[]): AssistantMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    type: message.type || message.kind,
    data: message.data,
    output: message.output,
    interaction: message.interaction,
    interaction_answered: message.interactionAnswered ?? message.interaction_answered,
    interaction_data: message.interactionData ?? message.interaction_data,
  }))
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

function AssistantInteractionNotice({
  answered,
  summary,
  disabled,
  onOpen,
}: {
  answered: boolean
  summary?: string
  disabled?: boolean
  onOpen: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
      <span className="min-w-0 truncate">
        {answered
          ? `已提交${summary ? `：${summary}` : '。'}`
          : '需要补充交互信息。'}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={disabled}
        onClick={onOpen}
      >
        {answered ? '查看参数' : '填写参数'}
      </Button>
    </div>
  )
}

type AssistantSuggestionChoice = {
  title: string
  detail: string
  prompt: string
}

function AssistantSuggestionChoices({
  content,
  disabled,
  onSelect,
}: {
  content: string
  disabled?: boolean
  onSelect: (choice: AssistantSuggestionChoice) => void
}) {
  const choices = extractAssistantSuggestions(content)
  if (choices.length === 0) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {choices.map((choice) => (
        <Button
          key={`${choice.title}-${choice.detail}`}
          type="button"
          size="sm"
          variant="secondary"
          className="h-auto max-w-full justify-start whitespace-normal rounded-full px-3 py-1.5 text-left text-xs font-normal"
          disabled={disabled}
          title={choice.detail}
          onClick={() => onSelect(choice)}
        >
          {choice.title}
        </Button>
      ))}
    </div>
  )
}

function extractAssistantSuggestions(content: string): AssistantSuggestionChoice[] {
  const text = String(content || '')
  const headingIndex = text.search(/下一步建议|Suggestions/i)
  if (headingIndex < 0) {
    return []
  }
  const lines = text.slice(headingIndex).split(/\r?\n/)
  const choices: AssistantSuggestionChoice[] = []
  for (const line of lines) {
    const match = line.match(
      /^\s*(?:[-*]|\d+[.、)])\s*(?:\*\*)?([^：:\n*]+?)(?:\*\*)?\s*[：:]\s*(.+?)\s*$/
    )
    if (!match) {
      continue
    }
    const title = match[1].replace(/\*\*/g, '').trim()
    const detail = match[2].replace(/\*\*/g, '').trim()
    if (!title || !detail) {
      continue
    }
    choices.push({
      title,
      detail,
      prompt: `请执行下一步建议：${title}。${detail}`,
    })
    if (choices.length >= 4) {
      break
    }
  }
  return choices
}

function summarizeSubmittedInteraction(data?: Record<string, unknown>) {
  if (!data) {
    return ''
  }
  for (const value of Object.values(data)) {
    const text = String(value ?? '').trim()
    if (text && text !== '[object Object]') {
      return text.length > 28 ? `${text.slice(0, 28)}...` : text
    }
  }
  return ''
}

function createMessageID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
