import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Bot,
  History,
  Loader2,
  Plus,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentInteractionPanel } from '@/components/agent/interaction-panel'
import { ContentView } from '@/components/energon/content-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import {
  ASSISTANT_DIALOG_LAYER_CLASS,
  ASSISTANT_DIALOG_LAYER_Z_INDEX,
  ASSISTANT_FLOATING_LAYER_CLASS,
  ASSISTANT_FLOATING_LAYER_Z_INDEX,
} from '@/lib/floating-layer'
import {
  assistantSessionContextKey,
  clearAssistantSession,
  loadAssistantSession,
  saveAssistantMessage,
  type AssistantMemoryReview,
} from '@/lib/assistant/session'
import { stripRouterBasePath } from '@/lib/router-path'
import { streamValueText } from '@/lib/stream'
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
import { AssistantSessionHistoryDialog } from './session-history-dialog'

const ASSISTANT_AGENT_KEY = 'front-assistant'

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

type AssistantHeaderIconButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function AssistantHeaderIconButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: AssistantHeaderIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            size="icon"
            variant={active ? 'secondary' : 'ghost'}
            disabled={disabled}
            aria-label={label}
            title={label}
            onClick={onClick}
          >
            {children}
            <span className="sr-only">{label}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={ASSISTANT_DIALOG_LAYER_CLASS}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
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
  const [sessionID, setSessionID] = useState(0)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
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
  const sessionContextKey = useMemo(
    () =>
      assistantSessionContextKey('front-assistant', {
        scope: 'global',
      }),
    []
  )
  const sessionTitle = 'AI 助理会话'
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

  const applyAssistantSessionPayload = useCallback(
    (payload: Awaited<ReturnType<typeof loadAssistantSession>>) => {
      setSessionID(payload.session?.id || 0)
      setMessages(restoreChatMessages(payload.messages))
    },
    []
  )

  const loadDrawerSession = useCallback(
    async (options: { sessionID?: number; newSession?: boolean } = {}) => {
      setSessionLoading(true)
      try {
        const payload = await loadAssistantSession({
          sessionID: options.sessionID,
          newSession: options.newSession,
          agentKey: ASSISTANT_AGENT_KEY,
          contextKey: sessionContextKey,
          title: sessionTitle,
          limit: 80,
        })
        applyAssistantSessionPayload(payload)
        return payload.session?.id || 0
      } finally {
        setSessionLoading(false)
      }
    },
    [applyAssistantSessionPayload, sessionContextKey, sessionTitle]
  )

  const ensureDrawerSession = useCallback(async () => {
    if (sessionID > 0) {
      return sessionID
    }
    return await loadDrawerSession()
  }, [loadDrawerSession, sessionID])

  const startNewSession = useCallback(async () => {
    await loadDrawerSession({ newSession: true })
    setInput('')
    setReferences([])
    setReferenceMessage('')
    setHistoryOpen(false)
  }, [loadDrawerSession])

  const clearCurrentSession = useCallback(async () => {
    if (sessionID <= 0) {
      setMessages([])
      return
    }
    setSessionLoading(true)
    try {
      const payload = await clearAssistantSession(sessionID)
      applyAssistantSessionPayload(payload)
    } finally {
      setSessionLoading(false)
    }
  }, [applyAssistantSessionPayload, sessionID])

  const openSessionFromHistory = useCallback(
    async (id: number) => {
      await loadDrawerSession({ sessionID: id })
      setHistoryOpen(false)
    },
    [loadDrawerSession]
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, running])

  useEffect(() => {
    if (!open) {
      return
    }
    void loadDrawerSession()
  }, [loadDrawerSession, open])

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

  const submitInteraction = async (
    messageID: string,
    result: AgentInteractionSubmitResult
  ) => {
    const sourceMessage = messages.find(
      (message) => message.id === messageID && message.role === 'assistant'
    )
    if (
      !sourceMessage?.interaction ||
      sourceMessage.interactionAnswered ||
      running
    ) {
      return
    }

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
    let activeSessionID = 0
    try {
      activeSessionID = await ensureDrawerSession()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '加载 AI 助理会话失败'
      setMessages((current) => [
        ...current,
        {
          id: createMessageID(),
          role: 'assistant',
          content: message,
        },
      ])
      return
    }

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
      await recordAssistantMessage({
        sessionID: activeSessionID,
        agentKey: ASSISTANT_AGENT_KEY,
        contextKey: sessionContextKey,
        role: 'user',
        text: userMessage.content,
        kind: options.messageKind || 'chat',
        content: {
          data: options.messageData,
          input: options.input || {},
          task: mergeAssistantTaskReferences(options.task, runReferences),
        },
      })
      let finalOutput: Record<string, unknown> = {}
      const finalText = await runAssistantAgent({
        text,
        input: options.input,
        task: mergeAssistantTaskReferences(options.task, runReferences),
        assistantSessionID: activeSessionID,
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
      const savedAssistant = await recordAssistantMessage({
        sessionID: activeSessionID,
        agentKey: ASSISTANT_AGENT_KEY,
        contextKey: sessionContextKey,
        role: 'assistant',
        text: visibleText,
        kind: interaction ? 'interaction' : 'chat',
        content: {
          interaction,
          interaction_answered: false,
        },
        output: buildAssistantMessageOutput(finalOutput, visibleText) || finalOutput,
      })
      const savedMessage = isRecord(savedAssistant?.message)
        ? savedAssistant.message
        : null
      const savedOutput = isRecord(savedMessage?.output)
        ? savedMessage.output
        : null
      const savedReview = normalizeMemoryReview(savedOutput?.memory_review)
      if (savedReview) {
        setMessages((current) =>
          patchAssistantMessage(current, assistantID, (message) => ({
            ...message,
            output: {
              ...(message.output || {}),
              memory_review: savedReview,
            },
          }))
        )
      }
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
      await recordAssistantMessage({
        sessionID: activeSessionID,
        agentKey: ASSISTANT_AGENT_KEY,
        contextKey: sessionContextKey,
        role: 'assistant',
        text: message,
        kind: 'error',
        output: { error: message },
        status: 2,
      })
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
        layerClassName={ASSISTANT_FLOATING_LAYER_CLASS}
        layerZIndex={ASSISTANT_FLOATING_LAYER_Z_INDEX}
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
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
              <div className="ms-auto flex items-center gap-1">
                <AssistantHeaderIconButton
                  label="历史会话"
                  active={historyOpen}
                  disabled={running || sessionLoading}
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="size-4" />
                </AssistantHeaderIconButton>
                <AssistantHeaderIconButton
                  label="新建会话"
                  disabled={running || sessionLoading}
                  onClick={() => void startNewSession()}
                >
                  <Plus className="size-4" />
                </AssistantHeaderIconButton>
                <AssistantHeaderIconButton
                  label="清空当前会话"
                  disabled={running || sessionLoading || messages.length === 0}
                  onClick={() => void clearCurrentSession()}
                >
                  <Trash2 className="size-4" />
                </AssistantHeaderIconButton>
                <AssistantHeaderIconButton
                  label="关闭助理"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-4" />
                </AssistantHeaderIconButton>
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
                        interaction={message.interaction}
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
                        <div className="mt-3">
                          <AgentInteractionPanel
                            interaction={message.interaction}
                            readonly={Boolean(message.interactionAnswered)}
                            initialData={message.interactionData}
                            autoSubmitValid
                            disabled={running}
                            onSubmit={
                              message.interactionAnswered
                                ? undefined
                                : (result) =>
                                    void submitInteraction(message.id, result)
                            }
                          />
                        </div>
                      ) : null}
                      <AssistantMemoryReviewCard
                        review={normalizeMemoryReview(message.output?.memory_review)}
                      />
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
      <AssistantSessionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        agentKey={ASSISTANT_AGENT_KEY}
        contextKey={sessionContextKey}
        activeSessionID={sessionID}
        disabled={running || sessionLoading}
        assistantLayer
        layerClassName={ASSISTANT_DIALOG_LAYER_CLASS}
        layerZIndex={ASSISTANT_DIALOG_LAYER_Z_INDEX}
        onOpenSession={(id) => openSessionFromHistory(id)}
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

async function recordAssistantMessage(
  input: Parameters<typeof saveAssistantMessage>[0]
) {
  try {
    return await saveAssistantMessage(input)
  } catch {
    // 会话保存失败不能中断本次前端助理交互。
    return null
  }
}

function restoreChatMessages(messages: AssistantMessage[]): ChatMessage[] {
  return messages.map((message, index) => {
    const parsed =
      message.role === 'assistant'
        ? extractAssistantFrontActions(message.content)
        : { actions: [] as AssistantFrontAction[] }
    return {
      ...message,
      id: `saved-${index}-${Math.random().toString(16).slice(2)}`,
      content: message.content,
      kind: message.type as ChatMessage['kind'],
      output: message.output,
      actions: parsed.actions,
      interaction: message.interaction,
      interactionAnswered: Boolean(message.interaction_answered),
      interactionData: message.interaction_data,
    }
  })
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
  interaction,
  pending,
}: {
  role: ChatMessage['role']
  content: string
  output?: ChatMessage['output']
  interaction?: AgentInteraction
  pending: boolean
}) {
  if (!content && !output) {
    return pending ? <div className="text-muted-foreground">...</div> : null
  }

  if (role === 'assistant') {
    const displayContent = interaction
      ? assistantInteractionDisplayText(content)
      : assistantDisplayText(content)
    const displayOutput = interaction
      ? displayContent
        ? { text: displayContent }
        : undefined
      : assistantDisplayOutput(output, displayContent)
    if (!displayOutput) {
      return null
    }
    return (
      <ContentView
        output={displayOutput}
        emptyText=""
        className="space-y-2 break-words [overflow-wrap:anywhere]"
      />
    )
  }

  return <div className="whitespace-pre-wrap break-all">{content}</div>
}

function assistantInteractionDisplayText(text: string) {
  const displayText = assistantDisplayText(text)
    .replace(
      /```(?:agent-interaction|agent-result|agent-output|json)\s*[\s\S]*?```/gi,
      ''
    )
    .trim()

  return isInteractionProtocolText(displayText) ? '' : displayText
}

function isInteractionProtocolText(text: string) {
  if (!text.startsWith('{')) {
    return false
  }

  try {
    const parsed = JSON.parse(text)
    if (!isRecord(parsed)) {
      return false
    }
    const interaction = isRecord(parsed.interaction)
      ? parsed.interaction
      : parsed
    return (
      Array.isArray(interaction.fields) ||
      Boolean(streamValueText(interaction.type).trim())
    )
  } catch {
    return false
  }
}

function assistantDisplayText(text: string) {
  const source = String(text || '')
  if (!source) {
    return ''
  }

  const parsed = extractAssistantFrontActions(source)
  if (parsed.cleanText) {
    return parsed.cleanText
  }
  if (parsed.actions.length > 0) {
    return ''
  }

  return source
    .replace(/```front-action\s*[\s\S]*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function assistantDisplayOutput(
  output: ChatMessage['output'] | undefined,
  fallbackText: string
) {
  if (!output) {
    return null
  }

  const sanitized = sanitizeAssistantActionTextOutput(output)
  if (!isRecord(sanitized)) {
    return hasAssistantDisplayValue(sanitized)
      ? sanitized
      : fallbackText
        ? { text: fallbackText }
        : null
  }

  const text = streamValueText(sanitized.text)
  if (text || fallbackText) {
    return compactAssistantOutput({
      ...sanitized,
      text: assistantDisplayText(text) || fallbackText,
    })
  }
  return compactAssistantOutput(sanitized)
}

function sanitizeAssistantActionTextOutput(value: unknown): unknown {
  if (typeof value === 'string') {
    return assistantDisplayText(value)
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAssistantActionTextOutput(item))
      .filter(hasAssistantDisplayValue)
  }
  if (!isRecord(value)) {
    return value
  }
  if (isAssistantFrontActionValue(value)) {
    return undefined
  }

  const next: Record<string, unknown> = {}
  for (const [key, current] of Object.entries(value)) {
    next[key] = sanitizeAssistantActionTextOutput(current)
  }
  return compactAssistantOutput(next)
}

function compactAssistantOutput(output: Record<string, unknown>) {
  const entries = Object.entries(output).filter(([, value]) =>
    hasAssistantDisplayValue(value)
  )
  if (entries.length === 0) {
    return null
  }
  return Object.fromEntries(entries)
}

function hasAssistantDisplayValue(value: unknown): boolean {
  if (value == null) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim() !== ''
  }
  if (Array.isArray(value)) {
    return value.some(hasAssistantDisplayValue)
  }
  if (isRecord(value)) {
    return Object.values(value).some(hasAssistantDisplayValue)
  }
  return true
}

function isAssistantFrontActionValue(value: Record<string, unknown>) {
  const type = streamValueText(value.type).trim()
  switch (type) {
    case 'fill_form':
      return Boolean(streamValueText(value.target).trim())
    case 'patch_form':
      return isRecord(value.values)
    case 'open_page':
      return Boolean(
        streamValueText(value.path).trim() ||
          streamValueText(value.route).trim() ||
          streamValueText(value.to).trim() ||
          streamValueText(value.permission_key).trim() ||
          streamValueText(value.permissionKey).trim() ||
          streamValueText(value.key).trim()
      )
    case 'open_form':
      return Boolean(
        streamValueText(value.path).trim() ||
          streamValueText(value.route).trim() ||
          streamValueText(value.form_path).trim() ||
          streamValueText(value.formPath).trim() ||
          streamValueText(value.permission_key).trim() ||
          streamValueText(value.permissionKey).trim() ||
          streamValueText(value.key).trim()
      )
    default:
      return false
  }
}

function AssistantMemoryReviewCard({
  review,
}: {
  review: AssistantMemoryReview | null
}) {
  if (!review || review.status === 'pending') {
    return null
  }
  return (
    <div className="mt-2 rounded-md border bg-muted/30 px-2 py-2 text-xs text-muted-foreground">
      <div className="font-medium text-foreground">
        {review.text || assistantMemoryReviewTitle(review.status)}
      </div>
      {review.title || review.content ? (
        <div className="mt-1 leading-5">
          {review.title ? <div className="text-foreground">{review.title}</div> : null}
          {review.content ? <div>{review.content}</div> : null}
        </div>
      ) : null}
      {review.error ? (
        <div className="mt-1 text-destructive">{streamValueText(review.error)}</div>
      ) : null}
    </div>
  )
}

function assistantMemoryReviewTitle(status: string) {
  switch (status) {
    case 'saved':
      return '已自动保存长期记忆'
    case 'updated':
      return '已自动更新长期记忆'
    case 'deduped':
      return '已更新长期记忆权重'
    case 'forgot':
      return '已清理相关长期记忆'
    default:
      return '长期记忆已处理'
  }
}

function normalizeMemoryReview(value: unknown): AssistantMemoryReview | null {
  if (!isRecord(value)) {
    return null
  }
  const status = streamValueText(value.status)
  if (!status) {
    return null
  }
  return {
    status,
    type: streamValueText(value.type),
    text: streamValueText(value.text),
    source_message_id: Number(value.source_message_id || 0) || undefined,
    title: streamValueText(value.title),
    content: streamValueText(value.content),
    scope: streamValueText(value.scope),
    kind: streamValueText(value.kind),
    reason: streamValueText(value.reason),
    memory: isRecord(value.memory) ? (value.memory as any) : null,
    existing: isRecord(value.existing) ? (value.existing as any) : null,
    ...(value.error ? { error: streamValueText(value.error) } : {}),
  } as AssistantMemoryReview
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

function createMessageID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
