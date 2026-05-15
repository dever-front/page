import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type StreamTimingStatus = 'running' | 'done' | 'failed' | 'canceled'

export type StreamTiming = {
  startedAt: number
  finishedAt?: number
  status: StreamTimingStatus
  label?: string
  percent?: number | null
}

export function useStreamClock(active: boolean, intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) {
      return
    }
    setNow(Date.now())
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      window.clearInterval(timer)
    }
  }, [active, intervalMs])

  return now
}

export function createStreamTiming(
  label = '等待生成结果',
  percent?: unknown
): StreamTiming {
  return {
    startedAt: Date.now(),
    status: 'running',
    label,
    percent: normalizeStreamPercent(percent),
  }
}

export function updateStreamTiming(
  timing: StreamTiming | undefined,
  label?: string,
  percent?: unknown,
  startedAt?: unknown
): StreamTiming {
  const nextPercent = normalizeStreamPercent(percent)
  const nextStartedAt = normalizeStreamTimestamp(startedAt)
  const nextLabel = String(label || '').trim()
  const current = timing || createStreamTiming(nextLabel || undefined)
  return {
    ...current,
    startedAt: timing ? current.startedAt : nextStartedAt ?? current.startedAt,
    label: nextLabel || current.label,
    percent: nextPercent ?? current.percent,
    status: current.status === 'failed' ? 'failed' : 'running',
    finishedAt: undefined,
  }
}

export function updateStreamTimingFromOutput(
  timing: StreamTiming | undefined,
  output: unknown,
  fallbackLabel?: string
) {
  const row = normalizeStreamTimingRecord(output)
  const meta = normalizeStreamTimingRecord(row.meta)
  return updateStreamTiming(
    timing,
    streamTimingText(row.text) || fallbackLabel,
    row.progress ?? row.percent ?? meta.progress ?? meta.percent,
    meta.started_at_ms ?? meta.started_at
  )
}

export function isStreamTimingStatusOutput(output: unknown) {
  const row = normalizeStreamTimingRecord(output)
  const meta = normalizeStreamTimingRecord(row.meta)
  const event = streamTimingText(row.event).toLowerCase()
  if (event === 'progress' || event === 'start' || event === 'status' || event === 'warning') {
    return true
  }
  const action = streamTimingText(meta.action).toLowerCase()
  if (action === 'call_power') {
    return true
  }
  return streamTimingText(row.text).startsWith('正在调用能力')
}

export function finishStreamTiming(
  timing: StreamTiming | undefined,
  status: Exclude<StreamTimingStatus, 'running'>
): StreamTiming | undefined {
  if (!timing || timing.status !== 'running') {
    return timing
  }
  return {
    ...timing,
    status,
    finishedAt: Date.now(),
  }
}

export function markStreamTimingStopping(
  timing: StreamTiming | undefined,
  label = '正在停止'
) {
  return updateStreamTiming(timing, label)
}

export function cancelStreamTiming(
  timing: StreamTiming | undefined,
  label = '已停止生成'
) {
  return finishStreamTiming(updateStreamTiming(timing, label), 'canceled')
}

export function StreamTimingBadge({
  timing,
  now,
  className,
}: {
  timing?: StreamTiming
  now: number
  className?: string
}) {
  if (!timing) {
    return null
  }

  const finishedAt = timing.finishedAt || now
  const duration = Math.max(0, finishedAt - timing.startedAt)
  const isRunning = timing.status === 'running'
  const label = streamTimingStatusLabel(timing.status)
  const percent = normalizeStreamPercent(timing.percent)

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs',
        isRunning
          ? 'border-primary/20 bg-primary/5 text-foreground'
          : timing.status === 'failed'
            ? 'border-destructive/25 bg-destructive/5 text-destructive'
            : 'border-muted bg-background/70 text-muted-foreground',
        className
      )}
      title={timing.label || undefined}
    >
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          isRunning
            ? 'bg-primary'
            : timing.status === 'failed'
              ? 'bg-destructive'
              : 'bg-muted-foreground'
        )}
      />
      <span className="shrink-0 font-medium">{label}</span>
      <span className="shrink-0 tabular-nums">{formatStreamDuration(duration)}</span>
      {isRunning && percent != null ? (
        <span className="shrink-0 text-muted-foreground tabular-nums">{percent}%</span>
      ) : null}
      {timing.label ? (
        <span className="min-w-0 max-w-56 truncate text-muted-foreground">
          {timing.label}
        </span>
      ) : null}
    </div>
  )
}

function streamTimingStatusLabel(status: StreamTimingStatus) {
  switch (status) {
    case 'failed':
      return '已失败'
    case 'canceled':
      return '已取消'
    case 'done':
      return '已完成'
    default:
      return '执行中'
  }
}

export function formatStreamDuration(durationMs: number) {
  const totalSeconds = Math.max(0, durationMs / 1000)
  if (totalSeconds < 10) {
    return `${totalSeconds.toFixed(1)}秒`
  }
  const roundedSeconds = Math.round(totalSeconds)
  if (roundedSeconds < 60) {
    return `${roundedSeconds}秒`
  }
  const minutes = Math.floor(roundedSeconds / 60)
  const seconds = roundedSeconds % 60
  return seconds > 0 ? `${minutes}分钟${seconds}秒` : `${minutes}分钟`
}

function normalizeStreamPercent(value: unknown) {
  if (value == null) {
    return null
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null
  }
  const percent = Number(value)
  if (!Number.isFinite(percent) || percent <= 0) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(percent)))
}

function normalizeStreamTimestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 100000000000 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) {
      return null
    }
    const numeric = Number(text)
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 100000000000 ? numeric * 1000 : numeric
    }
    const parsed = Date.parse(text)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function normalizeStreamTimingRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function streamTimingText(value: unknown) {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}
