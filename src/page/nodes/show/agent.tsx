import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Square,
} from 'lucide-react'
import { useStore } from 'zustand'
import { getStoreValueByPath } from '@/lib/store'
import {
  streamValueText as valueText,
  type RuntimeStreamFrame,
} from '@/lib/stream'
import {
  isEmptyRuntimeOutput,
  isPlainRecord as isPlainObject,
  normalizeRuntimeFrameOutput,
  resolveRuntimeFrameCancelable,
  runtimeErrorMessage,
} from '@/lib/runtime-stream-output'
import { runAgentStream, stopAgentStream } from '@/lib/agent/runner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  EnergonContentView,
  type EnergonOutput,
} from '@/components/energon/content-view'
import type { NodeItemProps } from '../../nodes'
import {
  AgentInteractionPanel,
  type AgentInteraction,
  type AgentInteractionSubmitResult,
} from './agent-interaction-panel'
import {
  cancelStreamTiming,
  StreamTimingBadge,
  createStreamTiming,
  finishStreamTiming,
  isStreamTimingStatusOutput,
  markStreamTimingStopping,
  updateStreamTimingFromOutput,
  useStreamClock,
  type StreamTiming,
} from './shared/stream-timing'

type AgentRole = 'user' | 'assistant'

type AgentStreamOutput = {
  text: string
  finalOutput: AgentOutput | null
}

type AgentMessage = {
  id: string
  role: AgentRole
  text: string
  output?: AgentStreamOutput
  interaction?: AgentInteraction
  interactionAnswered?: boolean
  interactionData?: Record<string, unknown>
  kind?: 'chat' | 'interaction_result'
  data?: Record<string, unknown>
  running?: boolean
  error?: string
  requestID?: string
  actionTiming?: StreamTiming
}

type AgentOutput = EnergonOutput & {
  kind?: string
  type?: string
  content?: unknown
  suggestions?: unknown
  interaction?: AgentInteraction
}

type AgentSuggestion = {
  label: string
  prompt: string
}

type AgentFrame = RuntimeStreamFrame<AgentOutput>

const EMPTY_OUTPUT: AgentStreamOutput = {
  text: '',
  finalOutput: null,
}

export function ShowAgent({ item, store }: NodeItemProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [requestID, setRequestID] = useState('')
  const [running, setRunning] = useState(false)
  const [cancelable, setCancelable] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState('')
  const [lastStreamID, setLastStreamID] = useState('0-0')
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false)
  const [interactionDialogMessageID, setInteractionDialogMessageID] =
    useState('')
  const messageListRef = useRef<HTMLDivElement>(null)
  const lastAutoScrollResultKeyRef = useRef('')
  const runTokenRef = useRef(0)
  const openWasTrackedRef = useRef(false)
  const scrollMessageListToBottom = useCallback(() => {
    const element = messageListRef.current
    if (!element) {
      return
    }
    scheduleAgentMessagesScrollToBottom(element)
  }, [])

  const agentKey = useStore(store, () =>
    valueText(getStoreValueByPath(store, String(item.meta?.agentPath || '')))
  )
  const agentName = useStore(store, () =>
    valueText(
      getStoreValueByPath(store, String(item.meta?.agentNamePath || ''))
    )
  )
  const openPath = String(item.meta?.openPath || '')
  const modalOpen = useStore(store, () =>
    openPath ? Boolean(getStoreValueByPath(store, openPath)) : true
  )
  const requestApi = String(item.meta?.requestApi || '/bot/agent/run')
  const streamApi = String(item.meta?.streamApi || '/bot/agent/stream')
  const stopApi = String(item.meta?.stopApi || '/bot/agent/stop')
  const paramApi = String(item.meta?.paramApi || '/bot/energon/power_params')
  const blockMs = Number(item.meta?.blockMs || 1000)
  const initialInput = String(item.meta?.initialInput || '')
  const inputPlaceholder = String(
    item.meta?.placeholder || '输入本轮任务，当前弹窗内的上下文会一起发送。'
  )
  const emptyText = String(item.meta?.emptyText || '')
  const containerHeight =
    valueText(item.meta?.height || item.meta?.containerHeight).trim() ||
    'min(calc(85vh - 11rem), 620px)'
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
  const pendingInteractionMessageID = pendingInteractionMessage?.id || ''
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

  const canSend = useMemo(
    () => input.trim().length > 0 && agentKey.length > 0 && !running,
    [agentKey, input, running]
  )
  const hasRunningActionTiming = useMemo(
    () =>
      messages.some(
        (message) =>
          message.actionTiming && message.actionTiming.status === 'running'
      ),
    [messages]
  )
  const nowMs = useStreamClock(hasRunningActionTiming)
  const latestVisibleResultKey = useMemo(
    () => buildLatestVisibleResultKey(messages),
    [messages]
  )

  useLayoutEffect(() => {
    if (
      !latestVisibleResultKey ||
      latestVisibleResultKey === lastAutoScrollResultKeyRef.current
    ) {
      return
    }
    lastAutoScrollResultKeyRef.current = latestVisibleResultKey

    const element = messageListRef.current
    if (!element) {
      return
    }

    return scheduleAgentMessagesScrollToBottom(element)
  }, [latestVisibleResultKey])

  const resetSession = useCallback(() => {
    runTokenRef.current += 1
    lastAutoScrollResultKeyRef.current = ''
    setMessages([])
    setInput(initialInput)
    setRequestID('')
    setRunning(false)
    setCancelable(false)
    setStopping(false)
    setError('')
    setLastStreamID('0-0')
    setInteractionDialogOpen(false)
    setInteractionDialogMessageID('')
  }, [initialInput])

  useEffect(() => {
    if (!openPath) {
      return
    }
    if (modalOpen && !openWasTrackedRef.current) {
      resetSession()
    }
    if (!modalOpen && openWasTrackedRef.current) {
      resetSession()
    }
    openWasTrackedRef.current = modalOpen
  }, [modalOpen, openPath, resetSession])

  useEffect(() => {
    resetSession()
  }, [agentKey, resetSession])

  useEffect(() => {
    if (pendingInteractionMessageID) {
      setInteractionDialogMessageID(pendingInteractionMessageID)
      setInteractionDialogOpen(true)
    }
  }, [pendingInteractionMessageID])

  const openInteractionDialog = (messageID: string) => {
    setInteractionDialogMessageID(messageID)
    setInteractionDialogOpen(true)
  }

  const changeInteractionDialogOpen = (open: boolean) => {
    setInteractionDialogOpen(open)
    if (!open) {
      setInteractionDialogMessageID('')
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || running) {
      return
    }
    await runAgent(
      { text },
      {
        role: 'user',
        text,
        kind: 'chat',
      },
      messages
    )
  }

  const sendSuggestion = async (suggestion: AgentSuggestion) => {
    const text = suggestion.prompt.trim()
    if (!text || running) {
      return
    }
    await runAgent(
      { text },
      {
        role: 'user',
        text,
        kind: 'chat',
      },
      messages
    )
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

    await runAgent(
      {
        type: 'interaction_result',
        interaction_id: sourceMessage.interaction.id || '',
        interaction_type: sourceMessage.interaction.type || '',
        interaction: sourceMessage.interaction,
        data: result.data,
        text: result.text,
      },
      {
        role: 'user',
        text: result.text,
        kind: 'interaction_result',
        data: result.data,
      },
      messages,
      sourceMessage.id,
      result.data
    )
  }

  const runAgent = async (
    inputPayload: Record<string, unknown>,
    userMessageBody: Omit<AgentMessage, 'id'>,
    historyMessages: AgentMessage[],
    answeredInteractionMessageID = '',
    answeredInteractionData?: Record<string, unknown>
  ) => {
    if (!agentKey) {
      setError('未选择智能体。')
      return
    }

    const token = runTokenRef.current + 1
    const userMessage: AgentMessage = {
      id: `${token}-user-${Date.now()}`,
      ...userMessageBody,
    }
    const assistantID = `${token}-assistant-${Date.now()}`
    const assistantMessage: AgentMessage = {
      id: assistantID,
      role: 'assistant',
      text: '',
      output: EMPTY_OUTPUT,
      running: true,
      actionTiming: createStreamTiming('等待智能体返回'),
    }
    const history = buildHistory(historyMessages)
    const requestInput = mergeAgentInputContext(
      inputPayload,
      resolveMetaPathMap(item.meta?.inputContext, store)
    )

    runTokenRef.current = token
    setMessages((current) => {
      const next = answeredInteractionMessageID
        ? current.map((message) =>
            message.id === answeredInteractionMessageID
              ? {
                  ...message,
                  interactionAnswered: true,
                  interactionData: answeredInteractionData,
                }
              : message
          )
        : current
      return [...next, userMessage, assistantMessage]
    })
    scrollMessageListToBottom()
    setInput('')
    setRunning(true)
    setCancelable(false)
    setStopping(false)
    setError('')
    setRequestID('')
    setLastStreamID('0-0')

    try {
      await runAgentStream<AgentOutput>({
        agent: agentKey,
        input: requestInput,
        history,
        requestApi,
        streamApi,
        stopApi,
        blockMs,
        onRequestID: setRequestID,
        onFrame: (frame) => {
          if (runTokenRef.current !== token) {
            return
          }
          const streamID = valueText(frame?.stream_id)
          if (streamID) {
            setLastStreamID(streamID)
          }
          applyFrameToMessage(assistantID, frame)
        },
      })
    } catch (currentError: unknown) {
      if (runTokenRef.current === token) {
        const message = runtimeErrorMessage(currentError, '智能体测试失败。')
        setError(message)
        markAssistantError(assistantID, message)
      }
    } finally {
      if (runTokenRef.current === token) {
        setRunning(false)
        setCancelable(false)
        setStopping(false)
        markAssistantDone(assistantID)
      }
    }
  }

  const stop = async () => {
    if (!requestID || !cancelable || stopping) {
      return
    }
    setStopping(true)
    markRunningAssistantStopping()
    try {
      await stopAgentStream(requestID, stopApi)
      runTokenRef.current += 1
      setRunning(false)
      setCancelable(false)
      markRunningAssistantCanceled()
    } catch (currentError: unknown) {
      setError(runtimeErrorMessage(currentError, '停止智能体失败。'))
    } finally {
      setStopping(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void send()
    }
  }

  const applyFrameToMessage = (
    messageID: string,
    frame: AgentFrame,
    options?: {
      updateCancelable?: boolean
    }
  ) => {
    const frameOutput = normalizeRuntimeFrameOutput(frame?.output, frame)
    if (isEmptyRuntimeOutput(frameOutput)) {
      return
    }
    const frameCancelable = resolveRuntimeFrameCancelable(frame)
    if (options?.updateCancelable !== false && frameCancelable != null) {
      setCancelable(frameCancelable)
    }

    updateAssistant(messageID, (message) => {
      const currentOutput = message.output || EMPTY_OUTPUT
      const nextOutput: AgentStreamOutput = {
        text: currentOutput.text,
        finalOutput: currentOutput.finalOutput,
      }

      const event = valueText(frameOutput.event).toLowerCase()
      const frameInteraction = normalizeFrameInteraction(
        frameOutput.interaction
      )
      let actionTiming = message.actionTiming
      if (isStreamTimingStatusOutput(frameOutput)) {
        actionTiming = updateStreamTimingFromOutput(actionTiming, frameOutput)
      }
      if (frame?.type === 'result') {
        nextOutput.finalOutput = frameOutput
        const finalText = valueText(frameOutput.text) || nextOutput.text
        return {
          ...message,
          text: finalText,
          interaction: frameInteraction || message.interaction,
          output: nextOutput,
          running: false,
          requestID: valueText(frame?.request_id) || message.requestID,
          actionTiming: finishStreamTiming(
            actionTiming,
            Number(frame.status) === 2 ? 'failed' : 'done'
          ),
        }
      }
      if (event === 'interaction') {
        if (frameOutput.text) {
          nextOutput.text = valueText(frameOutput.text)
        }
        return {
          ...message,
          text: nextOutput.text,
          interaction: frameInteraction || message.interaction,
          output: nextOutput,
          requestID: valueText(frame?.request_id) || message.requestID,
          actionTiming,
        }
      }
      if (event === 'delta' || (!event && frameOutput.text)) {
        nextOutput.text += valueText(frameOutput.text)
      }
      return {
        ...message,
        text: nextOutput.text,
        interaction: frameInteraction || message.interaction,
        output: nextOutput,
        requestID: valueText(frame?.request_id) || message.requestID,
        actionTiming,
      }
    })
  }

  const updateAssistant = (
    messageID: string,
    updater: (message: AgentMessage) => AgentMessage
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageID && message.role === 'assistant'
          ? updater(message)
          : message
      )
    )
  }

  const updateRunningAssistant = (
    updater: (message: AgentMessage) => AgentMessage
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.role === 'assistant' && message.running
          ? updater(message)
          : message
      )
    )
  }

  const markRunningAssistantStopping = () => {
    updateRunningAssistant((current) => ({
      ...current,
      actionTiming: markStreamTimingStopping(current.actionTiming),
    }))
  }

  const markRunningAssistantCanceled = () => {
    updateRunningAssistant((current) => ({
      ...current,
      running: false,
      actionTiming: cancelStreamTiming(current.actionTiming),
    }))
  }

  const markAssistantError = (messageID: string, message: string) => {
    updateAssistant(messageID, (current) => ({
      ...current,
      error: message,
      running: false,
      actionTiming: finishStreamTiming(current.actionTiming, 'failed'),
    }))
  }

  const markAssistantDone = (messageID: string) => {
    updateAssistant(messageID, (current) => ({
      ...current,
      running: false,
      actionTiming: finishStreamTiming(current.actionTiming, 'done'),
    }))
  }

  return (
    <div
      className='flex min-h-0 flex-col gap-3 overflow-hidden'
      style={{ height: containerHeight }}
    >
      <div
        ref={messageListRef}
        className='min-h-0 flex-1 space-y-3 overflow-y-auto rounded-md border bg-background p-3'
      >
        {messages.length === 0 ? (
          <div className='flex h-full min-h-48 items-center justify-center text-center text-sm text-muted-foreground'>
            {emptyText ||
              `输入一次任务开始测试${agentName ? `「${agentName}」` : '智能体'}。`}
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
                'max-w-[86%] rounded-md border px-3 py-2 text-sm leading-6',
                message.role === 'user'
                  ? 'border-primary/20 bg-primary text-primary-foreground'
                  : 'bg-muted/35 text-foreground'
              )}
            >
              {message.role === 'user' ? (
                <div className='whitespace-pre-wrap'>{message.text}</div>
              ) : (
                <AgentAssistantMessage
                  message={message}
                  now={nowMs}
                  running={running}
                  onOpenInteraction={openInteractionDialog}
                  onSendSuggestion={(suggestion) =>
                    void sendSuggestion(suggestion)
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <AgentInteractionDialog
        open={
          Boolean(interactionDialogMessage?.interaction) &&
          interactionDialogOpen
        }
        interaction={interactionDialogMessage?.interaction}
        paramApi={paramApi}
        readonly={Boolean(interactionDialogMessage?.interactionAnswered)}
        initialData={interactionDialogMessage?.interactionData}
        disabled={running}
        onOpenChange={changeInteractionDialogOpen}
        onSubmit={(result) => void submitInteraction(result)}
      />

      {error ? (
        <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
          {error}
        </div>
      ) : null}

      <div className='shrink-0 rounded-md border bg-background p-2.5'>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <div className='min-w-0 truncate text-xs text-muted-foreground'>
            {requestID
              ? `RequestID: ${requestID}${lastStreamID !== '0-0' ? ` / ${lastStreamID}` : ''}`
              : '关闭弹窗后会清空本次测试上下文。'}
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={running}
              onClick={resetSession}
            >
              <RotateCcw className='size-3.5' />
              新对话
            </Button>
            {running ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={!cancelable || stopping}
                onClick={() => void stop()}
              >
                {stopping ? (
                  <Loader2 className='size-3.5 animate-spin' />
                ) : (
                  <Square className='size-3.5' />
                )}
                停止
              </Button>
            ) : null}
            <Button
              type='button'
              size='sm'
              disabled={!canSend}
              onClick={() => void send()}
            >
              {running ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Send className='size-4' />
              )}
              发送
            </Button>
          </div>
        </div>
        <Textarea
          value={input}
          disabled={running}
          placeholder={inputPlaceholder}
          className='min-h-20 resize-none'
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}

function buildLatestVisibleResultKey(messages: AgentMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (
      message.role !== 'assistant' ||
      message.running ||
      message.error ||
      message.interaction
    ) {
      continue
    }
    if (hasContentViewOutput(buildContentViewOutput(message))) {
      return message.id
    }
  }
  return ''
}

function scrollAgentMessagesToBottom(element: HTMLElement) {
  element.scrollTop = element.scrollHeight
}

function scheduleAgentMessagesScrollToBottom(element: HTMLElement) {
  scrollAgentMessagesToBottom(element)
  const frameID = window.requestAnimationFrame(() => {
    scrollAgentMessagesToBottom(element)
  })
  const timerID = window.setTimeout(() => {
    scrollAgentMessagesToBottom(element)
  }, 120)

  return () => {
    window.cancelAnimationFrame(frameID)
    window.clearTimeout(timerID)
  }
}

function resolveMetaPathMap(value: unknown, store: NodeItemProps['store']) {
  if (!isPlainObject(value)) {
    return {}
  }

  const result: Record<string, unknown> = {}
  for (const [key, path] of Object.entries(value)) {
    const normalizedKey = String(key || '').trim()
    const normalizedPath = String(path || '').trim()
    if (!normalizedKey || !normalizedPath) {
      continue
    }
    result[normalizedKey] = getStoreValueByPath(store, normalizedPath)
  }
  return result
}

function mergeAgentInputContext(
  inputPayload: Record<string, unknown>,
  context: Record<string, unknown>
) {
  const normalizedContext = Object.fromEntries(
    Object.entries(context).filter(([, value]) => value != null && value !== '')
  )
  if (!Object.keys(normalizedContext).length) {
    return inputPayload
  }

  const existingContext = isPlainObject(inputPayload.context)
    ? inputPayload.context
    : {}
  return {
    ...inputPayload,
    context: {
      ...existingContext,
      ...normalizedContext,
    },
  }
}

function AgentAssistantMessage({
  message,
  now,
  running,
  onOpenInteraction,
  onSendSuggestion,
}: {
  message: AgentMessage
  now: number
  running: boolean
  onOpenInteraction: (messageID: string) => void
  onSendSuggestion: (suggestion: AgentSuggestion) => void
}) {
  const contentOutput = buildContentViewOutput(message)
  const hasOutput = hasContentViewOutput(contentOutput)
  const suggestions = buildMessageSuggestions(message, hasOutput)

  return (
    <div className='space-y-2'>
      <AgentResultKindBadge message={message} hasOutput={hasOutput} />
      {hasOutput ? (
        <EnergonContentView
          output={contentOutput}
          streaming={false}
          emptyText='等待智能体返回。'
        />
      ) : null}
      <StreamTimingBadge timing={message.actionTiming} now={now} />
      {message.error ? (
        <div className='rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive'>
          {message.error}
        </div>
      ) : null}
      {message.interaction ? (
        <div className='flex items-center justify-between gap-2 rounded-md border bg-background/80 px-2 py-1.5 text-xs text-muted-foreground'>
          <span>
            {message.interactionAnswered
              ? '交互信息已提交。'
              : '需要补充交互信息。'}
          </span>
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='h-7 px-2 text-xs'
            disabled={running && !message.interactionAnswered}
            onClick={() => onOpenInteraction(message.id)}
          >
            {message.interactionAnswered ? '查看参数' : '填写参数'}
          </Button>
        </div>
      ) : null}
      <AgentSuggestionBar
        suggestions={suggestions}
        disabled={running}
        onSelect={onSendSuggestion}
      />
      {message.requestID ? (
        <div className='truncate border-t pt-1 font-mono text-[11px] text-muted-foreground'>
          {message.requestID}
        </div>
      ) : null}
    </div>
  )
}

function AgentResultKindBadge({
  message,
  hasOutput,
}: {
  message: AgentMessage
  hasOutput: boolean
}) {
  const label = resolveMessageKindLabel(message, hasOutput)
  if (!label) {
    return null
  }
  return (
    <div className='inline-flex rounded-full border bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground'>
      {label}
    </div>
  )
}

function AgentSuggestionBar({
  suggestions,
  disabled,
  onSelect,
}: {
  suggestions: AgentSuggestion[]
  disabled?: boolean
  onSelect: (suggestion: AgentSuggestion) => void
}) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className='flex flex-wrap items-center gap-2 border-t pt-2'>
      {suggestions.map((suggestion, index) => (
        <Button
          key={`${suggestion.label}-${index}`}
          type='button'
          size='sm'
          variant='outline'
          className='h-7 rounded-full px-2.5 text-xs'
          disabled={disabled}
          title={suggestion.prompt}
          onClick={() => onSelect(suggestion)}
        >
          <MessageSquarePlus className='size-3.5' />
          {suggestion.label}
        </Button>
      ))}
    </div>
  )
}

function buildHistory(messages: AgentMessage[]) {
  return messages
    .map((message) => {
      const text = historyMessageText(message)
      const row: Record<string, unknown> = {
        role: message.role,
        text,
      }
      if (message.kind) {
        row.type = message.kind
      }
      if (message.data) {
        row.data = message.data
      }
      if (message.interaction) {
        row.interaction = message.interaction
        row.interaction_answered = Boolean(message.interactionAnswered)
        if (message.interactionData) {
          row.interaction_data = message.interactionData
        }
      }
      return row
    })
    .filter(
      (row) =>
        valueText(row.text).trim().length > 0 ||
        Boolean(row.interaction) ||
        Boolean(row.data)
    )
}

function historyMessageText(message: AgentMessage) {
  if (isProtocolDraftText(message.text)) {
    return ''
  }
  return message.text
}

function buildContentViewOutput(message: AgentMessage) {
  if (message.running || message.interaction) {
    return undefined
  }
  if (!message.output) {
    return message.text
      ? normalizeAgentDisplayOutput({ text: message.text })
      : undefined
  }
  if (message.output.finalOutput) {
    const finalOutput = normalizeAgentDisplayOutput(
      message.output.finalOutput,
      message.text
    )
    const event = valueText(finalOutput.event).toLowerCase()
    if (event === 'interaction' || isNonResultOutput(finalOutput)) {
      return undefined
    }
    return finalOutput
  }

  const items: EnergonOutput[] = []
  if (message.output.text && !isProtocolDraftText(message.output.text)) {
    items.push(normalizeAgentDisplayOutput({ text: message.output.text }))
  }
  return items
}

function buildMessageSuggestions(
  message: AgentMessage,
  hasOutput: boolean
): AgentSuggestion[] {
  if (message.running || message.error || message.interaction || !hasOutput) {
    return []
  }
  const output = message.output?.finalOutput
    ? normalizeAgentDisplayOutput(message.output.finalOutput, message.text)
    : normalizeAgentDisplayOutput({ text: message.text })
  const suggestions = normalizeAgentSuggestions(
    output.suggestions || output.meta?.suggestions
  )
  if (suggestions.length > 0) {
    return suggestions
  }
  return []
}

function resolveMessageKindLabel(message: AgentMessage, hasOutput: boolean) {
  if (message.interaction && !message.interactionAnswered) {
    return '需要用户参与'
  }
  const output = message.output?.finalOutput
  const kind = valueText(output?.kind || output?.type).toLowerCase()
  const action = valueText(output?.meta?.action).toLowerCase()
  if (kind === 'tool_result' || action === 'call_power') {
    return '工具结果'
  }
  if (hasOutput) {
    return '最终结果'
  }
  return ''
}

function normalizeAgentDisplayOutput(
  output: AgentOutput,
  fallbackText = ''
): AgentOutput {
  const next: AgentOutput = { ...output }
  delete next.reasoning

  const protocol = extractAgentResultPayload(
    valueText(next.text) || fallbackText
  )
  if (protocol) {
    const text = agentResultText(protocol.payload) || protocol.cleanText
    if (text) {
      next.text = text
    }
    next.kind = normalizeAgentOutputKind(
      valueText(
        protocol.payload.kind || protocol.payload.type || protocol.payload.event
      )
    )
    next.suggestions = protocol.payload.suggestions
    next.content = protocol.payload.content
    return next
  }

  if (!valueText(next.text)) {
    const text = agentResultText(next)
    if (text) {
      next.text = text
    }
  }
  return next
}

function isNonResultOutput(output: AgentOutput) {
  const event = valueText(output.event).toLowerCase()
  if (['start', 'progress', 'status', 'reasoning', 'warning'].includes(event)) {
    return true
  }
  return isProtocolDraftText(valueText(output.text))
}

function isProtocolDraftText(value: unknown) {
  const text = valueText(value).trim()
  if (!text) {
    return false
  }
  if (
    text.includes('```agent-interaction') ||
    text.includes('```agent-action') ||
    text.includes('```agent-result') ||
    text.includes('```agent-output')
  ) {
    return true
  }
  const looksLikeJSONDraft = text.startsWith('{') || text.startsWith('"')
  return (
    looksLikeJSONDraft &&
    (text.includes('"type"') ||
      text.includes('"fields"') ||
      text.includes('"options"') ||
      text.includes('"power"') ||
      text.includes('"suggestions"'))
  )
}

function extractAgentResultPayload(text: string):
  | {
      cleanText: string
      payload: Record<string, unknown>
    }
  | undefined {
  for (const lang of ['agent-result', 'agent-output', 'json']) {
    const result = extractAgentResultPayloadByLang(text, lang)
    if (result) {
      return result
    }
  }
  return undefined
}

function extractAgentResultPayloadByLang(
  text: string,
  lang: string
):
  | {
      cleanText: string
      payload: Record<string, unknown>
    }
  | undefined {
  const pattern = new RegExp(`\`\`\`${lang}\\s*([\\s\\S]*?)\`\`\``)
  const match = text.match(pattern)
  if (!match) {
    return undefined
  }
  const payload = parseAgentResultPayload(match[1])
  if (!payload) {
    return undefined
  }
  return {
    cleanText: text.replace(match[0], '').trim(),
    payload,
  }
}

function parseAgentResultPayload(value: string) {
  try {
    const parsed = JSON.parse(value.trim())
    return isAgentResultPayload(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function isAgentResultPayload(
  value: unknown
): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false
  }
  const kind = normalizeAgentOutputKind(
    valueText(value.kind || value.type || value.event)
  )
  return (
    kind === 'final_result' ||
    kind === 'tool_result' ||
    'content' in value ||
    'suggestions' in value
  )
}

function normalizeAgentOutputKind(value: string) {
  const kind = value.toLowerCase().trim()
  if (['tool', 'tool_result', 'call_power', 'power_result'].includes(kind)) {
    return 'tool_result'
  }
  if (['final', 'result', 'final_result', 'answer'].includes(kind)) {
    return 'final_result'
  }
  return kind || 'final_result'
}

function agentResultText(value: unknown): string {
  if (!isPlainObject(value)) {
    return valueText(value)
  }
  if (valueText(value.text)) {
    return valueText(value.text)
  }
  const content = value.content
  if (!isPlainObject(content)) {
    return valueText(content)
  }
  return valueText(content.text || content.markdown || content.html)
}

function normalizeAgentSuggestions(value: unknown): AgentSuggestion[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]
  return values
    .map(normalizeAgentSuggestion)
    .filter((suggestion): suggestion is AgentSuggestion => suggestion != null)
    .slice(0, 4)
}

function normalizeAgentSuggestion(value: unknown): AgentSuggestion | null {
  if (!isPlainObject(value)) {
    const text = valueText(value).trim()
    return text ? { label: text, prompt: text } : null
  }
  const prompt = valueText(
    value.prompt || value.text || value.value || value.input
  ).trim()
  const label = valueText(
    value.label || value.name || value.title || prompt
  ).trim()
  if (!label || !prompt) {
    return null
  }
  return { label, prompt }
}

function AgentInteractionDialog({
  open,
  interaction,
  paramApi,
  readonly,
  initialData,
  disabled,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  interaction?: AgentInteraction
  paramApi: string
  readonly?: boolean
  initialData?: Record<string, unknown>
  disabled?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (result: AgentInteractionSubmitResult) => void
}) {
  if (!interaction) {
    return null
  }
  const title = valueText(interaction.title) || '补充交互信息'
  const description =
    valueText(interaction.description) ||
    (readonly
      ? '已提交的交互信息，只读查看。'
      : '填写这些参数后，智能体会继续执行当前任务。')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl'>
        <DialogHeader className='border-b px-5 py-4 text-start'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='min-h-0 overflow-hidden'>
          <AgentInteractionPanel
            interaction={interaction}
            paramApi={paramApi}
            readonly={readonly}
            initialData={initialData}
            disabled={disabled}
            layout='dialog'
            hideHeader
            autoSubmitWhenReady={!readonly}
            onSubmit={readonly ? undefined : onSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function hasContentViewOutput(value: unknown): boolean {
  if (value == null || value === '') {
    return false
  }
  if (Array.isArray(value)) {
    return value.some(hasContentViewOutput)
  }
  if (isPlainObject(value)) {
    return Object.keys(value).length > 0
  }
  return true
}

function normalizeFrameInteraction(
  value: unknown
): AgentInteraction | undefined {
  if (!isPlainObject(value)) {
    return undefined
  }
  const type = valueText(value.type)
  if (!type) {
    return undefined
  }
  return value as AgentInteraction
}
