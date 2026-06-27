import { requestRaw } from '@/lib/request'
import { RUN_EVENT } from '@/lib/run-events'
import {
  assertRuntimeStreamFrameSuccess,
  readRuntimeStreamEvents,
  readRuntimeStreamFrame,
  streamValueText,
  type RuntimeStreamFrame,
} from '@/lib/stream'
import { normalizeRuntimeFrameOutput } from '@/lib/runtime-stream-output'

export type RuntimeStreamStatus<TOutput = Record<string, unknown>> = {
  text: string
  output: TOutput
  frame: RuntimeStreamFrame<TOutput>
}

export type RuntimeStreamOptions<TOutput = Record<string, unknown>> = {
  requestApi: string
  streamApi: string
  stopApi?: string
  stopOnAbort?: boolean
  body: Record<string, unknown>
  blockMs?: number
  transport?: 'sse' | 'poll'
  useStartFrameStreamID?: boolean
  signal?: AbortSignal
  missingRequestIDMessage?: string
  onRequestID?: (requestID: string) => void
  onFrame?: (frame: RuntimeStreamFrame<TOutput>) => void
  onDelta?: (text: string, status?: RuntimeStreamStatus<TOutput>) => void
  onStatus?: (text: string, status?: RuntimeStreamStatus<TOutput>) => void
  onFinalOutput?: (output: TOutput) => void
}

export type RuntimeStreamResult<TOutput = Record<string, unknown>> = {
  requestID: string
  finalOutput: TOutput
  textOutput: string
}

export type RuntimeStreamWatchOptions<TOutput = Record<string, unknown>> = {
  streamApi: string
  requestID: string
  lastID?: string
  blockMs?: number
  transport?: 'sse' | 'poll'
  signal?: AbortSignal
  stopOnResult?: boolean
  recoverOnError?: boolean
  retryDelayMs?: number
  maxRetryDelayMs?: number
  onFrame?: (frame: RuntimeStreamFrame<TOutput>) => boolean | void
}

export type RuntimeStreamWatchResult = {
  lastID: string
  completed: boolean
}

export async function runRuntimeStream<TOutput = Record<string, unknown>>({
  requestApi,
  streamApi,
  stopApi,
  stopOnAbort = true,
  body,
  blockMs = 1000,
  transport = 'sse',
  useStartFrameStreamID = false,
  signal,
  missingRequestIDMessage = '流式请求缺少 request_id。',
  onRequestID,
  onFrame,
  onDelta,
  onStatus,
  onFinalOutput,
}: RuntimeStreamOptions<TOutput>): Promise<RuntimeStreamResult<TOutput>> {
  const startFrame = await requestRaw(requestApi, 'post', body)
  assertRuntimeStreamFrameSuccess(startFrame)

  const requestID = streamValueText(startFrame?.request_id)
  if (!requestID) {
    throw new Error(missingRequestIDMessage)
  }
  onRequestID?.(requestID)

  let lastID =
    useStartFrameStreamID ? streamValueText(startFrame?.stream_id) || '0-0' : '0-0'
  let textOutput = ''
  let finalOutput = {} as TOutput

  const applyFrame = (frame: RuntimeStreamFrame<TOutput>) => {
    onFrame?.(frame)
    const output = normalizeRuntimeFrameOutput(
      frame?.output,
      frame as RuntimeStreamFrame<Record<string, any>>
    ) as TOutput
    const outputRecord = output as Record<string, unknown>
    const event = runtimeStreamEvent(outputRecord)
    const frameText = streamValueText(outputRecord.text)
    const status = { text: frameText, output, frame }

    if (event === 'delta' || (!event && frameText && frame.type !== 'result')) {
      textOutput += frameText
      onDelta?.(frameText, status)
    } else if (isRuntimeStatusEvent(event)) {
      onStatus?.(frameText, status)
    }

    if (frame.type === 'result') {
      finalOutput = output
      onFinalOutput?.(finalOutput)
    }
  }

  applyFrame(startFrame as RuntimeStreamFrame<TOutput>)
  if (startFrame?.type === 'result') {
    return { requestID, finalOutput, textOutput }
  }

  const watchResult = await watchRuntimeStream<TOutput>({
    streamApi,
    requestID,
    lastID,
    blockMs,
    transport,
    signal,
    stopOnResult: true,
    onFrame: (frame) => {
      applyFrame(frame)
    },
  })

  if (watchResult.completed) {
    return { requestID, finalOutput, textOutput }
  }

  if (stopApi && stopOnAbort) {
    await stopRuntimeStream(requestID, stopApi)
  }
  return { requestID, finalOutput, textOutput }
}

function isRuntimeStatusEvent(event: string) {
  return [
    'start',
    'progress',
    'status',
    'warning',
    RUN_EVENT.runStarted,
    RUN_EVENT.runFinished,
    RUN_EVENT.thinkStarted,
    RUN_EVENT.thinkFinished,
    RUN_EVENT.nodeStarted,
    RUN_EVENT.nodeOutput,
    RUN_EVENT.nodeFinished,
    RUN_EVENT.edgeActive,
    RUN_EVENT.waiting,
    RUN_EVENT.resultCreated,
    RUN_EVENT.resultProgress,
    RUN_EVENT.taskProgress,
    RUN_EVENT.taskDone,
  ].includes(event)
}

function runtimeStreamEvent(output: Record<string, unknown>) {
  return streamValueText(output.semantic_event || output.event).toLowerCase()
}

export async function watchRuntimeStream<TOutput = Record<string, unknown>>({
  streamApi,
  requestID,
  lastID = '0-0',
  blockMs = 1000,
  transport = 'sse',
  signal,
  stopOnResult = true,
  recoverOnError = true,
  retryDelayMs = 1000,
  maxRetryDelayMs = 5000,
  onFrame,
}: RuntimeStreamWatchOptions<TOutput>): Promise<RuntimeStreamWatchResult> {
  let cursor = lastID || '0-0'
  let completed = false
  let mode = transport
  let nextRetryDelayMs = Math.max(250, retryDelayMs)

  const consumeFrame = (frame: RuntimeStreamFrame<TOutput>) => {
    if (signal?.aborted) {
      return false
    }
    const streamID = streamValueText(frame?.stream_id)
    if (streamID) {
      cursor = streamID
    }
    assertRuntimeStreamFrameSuccess(frame)
    if (onFrame?.(frame) === false) {
      return false
    }
    if (stopOnResult && frame?.type === 'result') {
      completed = true
      return false
    }
  }

  const recover = async (error: unknown) => {
    if (!recoverOnError || !isRecoverableRuntimeStreamError(error)) {
      throw error
    }
    await waitRuntimeStreamRetry(nextRetryDelayMs, signal)
    nextRetryDelayMs = Math.min(Math.max(nextRetryDelayMs * 2, 250), maxRetryDelayMs)
    mode = 'poll'
  }

  while (!signal?.aborted && !completed) {
    if (mode === 'sse') {
      try {
        await readRuntimeStreamEvents<TOutput>(
          streamApi,
          requestID,
          cursor,
          blockMs,
          consumeFrame,
          signal
        )
        if (!completed) {
          mode = 'poll'
        }
        nextRetryDelayMs = Math.max(250, retryDelayMs)
      } catch (error) {
        await recover(error)
      }
      continue
    }

    try {
      const frame = await readRuntimeStreamFrame<TOutput>(
        streamApi,
        requestID,
        cursor,
        blockMs
      )
      nextRetryDelayMs = Math.max(250, retryDelayMs)
      if (consumeFrame(frame) === false) {
        break
      }
    } catch (error) {
      await recover(error)
    }
  }
  return { lastID: cursor, completed }
}

function isRecoverableRuntimeStreamError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false
  }
  if (error instanceof TypeError) {
    return true
  }
  const message = error instanceof Error ? error.message : streamValueText(error)
  return /network|failed to fetch|读取运行流失败\((408|425|429|500|502|503|504)\)/i.test(message)
}

function waitRuntimeStreamRetry(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    const timerID = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timerID)
        resolve()
      },
      { once: true }
    )
  })
}

export async function stopRuntimeStream(requestID: string, stopApi: string) {
  if (!requestID) {
    return null
  }
  const frame = await requestRaw(stopApi, 'post', { request_id: requestID })
  assertRuntimeStreamFrameSuccess(frame)
  return frame
}
