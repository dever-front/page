import {
  runAgentStream,
  stopAgentStream,
  type AgentStreamStatus,
} from '@/lib/agent/runner'
import { streamValueText } from '@/lib/stream'
import type { AssistantPageContext } from './context'
import type { AssistantPermissionContext } from './actions'
import { buildAssistantPermissionPayload } from './permission'

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
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
      page_context: context,
      permission_context: buildAssistantPermissionPayload(permissionContext),
      task,
    },
    history: history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
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

function assistantFinalText(output: Record<string, unknown>) {
  const text = streamValueText(output.text)
  if (text) {
    return extractAgentResultText(text)
  }
  const content = output.content
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return streamValueText((content as Record<string, unknown>).text)
  }
  return ''
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
      return streamValueText(content.text || content.markdown || content.html) || text
    }
    return streamValueText(payload?.text) || text.replace(match[0], '').trim()
  } catch {
    return text.replace(match[0], '').trim()
  }
}
