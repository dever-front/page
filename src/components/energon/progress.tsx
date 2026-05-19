export function EnergonProgressBlock({
  message,
  percent,
}: {
  message?: string
  percent?: number | null
}) {
  const normalizedPercent = normalizeEnergonPercent(percent)
  return (
    <div className="rounded-lg border bg-muted/25 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{String(message || '').trim() || '处理中...'}</span>
        {normalizedPercent != null ? (
          <span className="shrink-0 tabular-nums">{normalizedPercent}%</span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        {normalizedPercent != null ? (
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${normalizedPercent}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/75" />
        )}
      </div>
    </div>
  )
}

export function normalizeEnergonPercent(value: unknown) {
  if (value == null || value === '') {
    return null
  }
  const percent = Number(value)
  if (!Number.isFinite(percent)) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(percent)))
}
