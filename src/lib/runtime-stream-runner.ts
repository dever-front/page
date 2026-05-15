import { requestRaw } from '@/lib/request'
import {
  assertRuntimeStreamFrameSuccess,
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

export async function runRuntimeStream<TOutput = Record<string, unknown>>({
  requestApi,
  streamApi,
  stopApi,
  stopOnAbort = true,
  body,
  blockMs = 1000,
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
    const event = streamValueText(outputRecord.event).toLowerCase()
    const frameText = streamValueText(outputRecord.text)
    const status = { text: frameText, output, frame }

    if (event === 'delta' || (!event && frameText && frame.type !== 'result')) {
      textOutput += frameText
      onDelta?.(frameText, status)
    } else if (['start', 'progress', 'status', 'warning'].includes(event)) {
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

  while (!signal?.aborted) {
    const frame = await readRuntimeStreamFrame<TOutput>(
      streamApi,
      requestID,
      lastID,
      blockMs
    )
    if (signal?.aborted) {
      break
    }
    const streamID = streamValueText(frame?.stream_id)
    if (streamID) {
      lastID = streamID
    }

    assertRuntimeStreamFrameSuccess(frame)
    applyFrame(frame)
    if (frame?.type === 'result') {
      return { requestID, finalOutput, textOutput }
    }
  }

  if (stopApi && stopOnAbort) {
    await stopRuntimeStream(requestID, stopApi)
  }
  return { requestID, finalOutput, textOutput }
}

export async function stopRuntimeStream(requestID: string, stopApi: string) {
  if (!requestID) {
    return null
  }
  const frame = await requestRaw(stopApi, 'post', { request_id: requestID })
  assertRuntimeStreamFrameSuccess(frame)
  return frame
}
