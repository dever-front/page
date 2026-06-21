import {
  runAgentStream,
  stopAgentStream,
  type AgentStreamStatus,
} from '@/lib/agent/runner'
import type { AgentInteraction } from '@/lib/agent/types'
import { streamValueText } from '@/lib/stream'
import type { AssistantPageContext } from './context'
import type { AssistantPermissionContext } from './actions'
import { buildAssistantPermissionPayload } from './permission'

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
  type?: string
  data?: Record<string, unknown>
  output?: Record<string, unknown>
  interaction?: AgentInteraction
  interaction_answered?: boolean
  interaction_data?: Record<string, unknown>
}

export type AssistantStatusHandler = (
  text: string,
  status?: AgentStreamStatus<Record<string, unknown>>
) => void

export type AssistantRunOptions = {
  text: string
  input?: Record<string, unknown>
  context: AssistantPageContext | null
  permissionContext?: AssistantPermissionContext | null
  task?: Record<string, unknown>
  assistantSessionID?: number
  history: AssistantMessage[]
  signal?: AbortSignal
  onDelta?: (text: string) => void
  onStatus?: AssistantStatusHandler
  onFinalOutput?: (output: Record<string, unknown>) => void
}

export async function runAssistantAgent({
  text,
  input,
  context,
  permissionContext,
  task,
  assistantSessionID,
  history,
  signal,
  onDelta,
  onStatus,
  onFinalOutput,
}: AssistantRunOptions) {
  const result = await runAgentStream<Record<string, unknown>>({
    agent: 'front-assistant',
    input: {
      ...(input ?? {}),
      text,
      assistant_session_id: assistantSessionID || undefined,
      page_context: context,
      permission_context: buildAssistantPermissionPayload(permissionContext),
      task,
    },
    history: history.map(buildAssistantHistoryRow),
    signal,
    onDelta,
    onStatus,
    onFinalOutput,
  })
  const finalText = assistantFinalText(result.finalOutput)
  return finalText || result.textOutput
}

export async function stopAssistantAgent(requestID: string) {
  await stopAgentStream(requestID)
}

function buildAssistantHistoryRow(message: AssistantMessage) {
  const row: Record<string, unknown> = {
    role: message.role,
    content: message.content,
    text: message.content,
  }
  if (message.type) {
    row.type = message.type
  }
  if (message.data) {
    row.data = message.data
  }
  if (message.output) {
    row.output = message.output
  }
  if (message.interaction) {
    row.interaction = message.interaction
    row.interaction_answered = Boolean(message.interaction_answered)
    if (message.interaction_data) {
      row.interaction_data = message.interaction_data
    }
  }
  return row
}

function assistantFinalText(output: Record<string, unknown>) {
  const nestedResult = output.result
  if (nestedResult && typeof nestedResult === 'object' && !Array.isArray(nestedResult)) {
    const nestedText = assistantFinalText(nestedResult as Record<string, unknown>)
    if (nestedText) {
      return nestedText
    }
  }

  const text = streamValueText(output.text)
  if (text) {
    return isAssistantResultShellText(text) ? '' : extractAgentResultText(text)
  }
  const content = output.content
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const contentText = streamValueText((content as Record<string, unknown>).text)
    return isAssistantResultShellText(contentText) ? '' : contentText
  }
  return ''
}

function isAssistantResultShellText(text: string) {
  const value = text.trim()
  return value === '内容已生成，点击查看结果。' || value === '内容已生成'
}

function extractAgentResultText(text: string) {
  const match = text.match(/```agent-result\s*([\s\S]*?)```/)
  if (!match) {
    return text
  }
  try {
    const payload = JSON.parse(match[1].trim())
    const content = payload?.content
    if (content && typeof content === 'object') {
      return streamValueText(content.text) || text
    }
    return streamValueText(payload?.text) || text.replace(match[0], '').trim()
  } catch {
    return text.replace(match[0], '').trim()
  }
}
