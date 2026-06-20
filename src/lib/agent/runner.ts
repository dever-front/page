import type { RuntimeStreamFrame } from '@/lib/stream'
import {
  runRuntimeStream,
  stopRuntimeStream,
  type RuntimeStreamResult,
  type RuntimeStreamStatus,
} from '@/lib/runtime-stream-runner'

export type AgentStreamOptions<TOutput = Record<string, unknown>> = {
  agent: string
  input: Record<string, unknown>
  history?: unknown[]
  options?: Record<string, unknown>
  requestApi?: string
  streamApi?: string
  stopApi?: string
  blockMs?: number
  signal?: AbortSignal
  onRequestID?: (requestID: string) => void
  onFrame?: (frame: RuntimeStreamFrame<TOutput>) => void
  onDelta?: (text: string) => void
  onStatus?: (text: string, status?: AgentStreamStatus<TOutput>) => void
  onFinalOutput?: (output: TOutput) => void
}

export type AgentStreamStatus<TOutput = Record<string, unknown>> =
  RuntimeStreamStatus<TOutput>

export type AgentStreamResult<TOutput = Record<string, unknown>> =
  RuntimeStreamResult<TOutput>

const DEFAULT_REQUEST_API = '/bot/admin/agent/run'
const DEFAULT_STREAM_API = '/bot/admin/agent/stream'
const DEFAULT_STOP_API = '/bot/admin/agent/stop'

export async function runAgentStream<TOutput = Record<string, unknown>>({
  agent,
  input,
  history = [],
  options,
  requestApi = DEFAULT_REQUEST_API,
  streamApi = DEFAULT_STREAM_API,
  stopApi = DEFAULT_STOP_API,
  blockMs = 1000,
  signal,
  onRequestID,
  onFrame,
  onDelta,
  onStatus,
  onFinalOutput,
}: AgentStreamOptions<TOutput>): Promise<AgentStreamResult<TOutput>> {
  return await runRuntimeStream<TOutput>({
    requestApi,
    streamApi,
    stopApi,
    blockMs,
    signal,
    missingRequestIDMessage: '智能体运行缺少 request_id。',
    body: {
      agent,
      input,
      history,
      options: {
        ...(options || {}),
        stream: true,
      },
    },
    onRequestID,
    onFrame,
    onDelta,
    onStatus,
    onFinalOutput,
  })
}

export async function stopAgentStream(
  requestID: string,
  stopApi = DEFAULT_STOP_API
) {
  return await stopRuntimeStream(requestID, stopApi)
}
