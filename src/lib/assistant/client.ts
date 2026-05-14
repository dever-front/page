import { requestRaw } from '@/lib/request'
import {
  assertRuntimeStreamFrameSuccess,
  readRuntimeStreamFrame,
  streamValueText,
  type RuntimeStreamFrame,
} from '@/lib/stream'
import { normalizeRuntimeFrameOutput } from '@/lib/runtime-stream-output'
import type { AssistantPageContext } from './context'

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AssistantRunOptions = {
  text: string
  context: AssistantPageContext | null
  history: AssistantMessage[]
  signal?: AbortSignal
  onDelta?: (text: string) => void
  onStatus?: (text: string) => void
}

export async function runAssistantAgent({
  text,
  context,
  history,
  signal,
  onDelta,
  onStatus,
}: AssistantRunOptions) {
  const startFrame = await requestRaw('/bot/agent/run', 'post', {
    agent: 'front-assistant',
    input: {
      text,
      page_context: context,
    },
    history: history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    options: {
      stream: true,
    },
  })
  assertRuntimeStreamFrameSuccess(startFrame)

  const requestID = streamValueText(startFrame?.request_id)
  if (!requestID) {
    throw new Error('AI 助理请求缺少 request_id。')
  }

  const firstText = assistantFrameText(startFrame)
  if (firstText) {
    onStatus?.(firstText)
  }

  let lastID = '0-0'
  let textOutput = ''

  while (!signal?.aborted) {
    const frame = await readRuntimeStreamFrame(
      '/bot/agent/stream',
      requestID,
      lastID,
      1000
    )
    const streamID = streamValueText(frame?.stream_id)
    if (streamID) {
      lastID = streamID
    }

    assertRuntimeStreamFrameSuccess(frame)
    const output = normalizeRuntimeFrameOutput(frame?.output, frame)
    const event = streamValueText(output.event).toLowerCase()
    const frameText = streamValueText(output.text)

    if (event === 'delta' || (!event && frameText && frame.type !== 'result')) {
      textOutput += frameText
      onDelta?.(frameText)
    } else if (['start', 'progress', 'status', 'warning'].includes(event)) {
      onStatus?.(frameText)
    }

    if (frame.type === 'result') {
      const finalText = assistantFinalText(output as Record<string, unknown>)
      if (finalText && finalText !== textOutput) {
        textOutput = finalText
      }
      return textOutput
    }
  }

  if (requestID) {
    await stopAssistantAgent(requestID)
  }
  return textOutput
}

export async function stopAssistantAgent(requestID: string) {
  if (!requestID) {
    return
  }
  await requestRaw('/bot/agent/stop', 'post', { request_id: requestID })
}

function assistantFrameText(frame: RuntimeStreamFrame) {
  return streamValueText(normalizeRuntimeFrameOutput(frame?.output, frame).text)
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
