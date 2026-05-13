import type { EnergonOutput } from '@/components/energon/content-view'
import {
  streamValueText as valueText,
  type RuntimeStreamFrame,
} from '@/lib/stream'

export function normalizeRuntimeFrameOutput<
  TOutput extends EnergonOutput = EnergonOutput,
>(value: unknown, frame?: RuntimeStreamFrame<TOutput>): TOutput {
  if (isPlainRecord(value) && Object.keys(value).length > 0) {
    return value as TOutput
  }

  if (Number(frame?.status) === 2) {
    const message = valueText(frame?.msg) || '请求失败。'
    return {
      event: 'status',
      text: message,
      error: message,
    } as TOutput
  }

  return isPlainRecord(value) ? (value as TOutput) : ({} as TOutput)
}

export function isEmptyRuntimeOutput(value: unknown) {
  return isPlainRecord(value) && Object.keys(value).length === 0
}

export function resolveRuntimeFrameCancelable(frame: unknown): boolean | null {
  if (!isPlainRecord(frame)) {
    return null
  }
  const output = frame.output
  if (!isPlainRecord(output)) {
    return null
  }
  const meta = output.meta
  if (!isPlainRecord(meta) || !('cancelable' in meta)) {
    return null
  }
  return Boolean(meta.cancelable)
}

export function runtimeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
