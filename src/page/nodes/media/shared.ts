export function resolveMediaMaxVisible(
  meta: Record<string, any> | undefined,
  compact: boolean,
  total: number
) {
  const configured = Number(meta?.maxVisible || 0)
  if (configured > 0) {
    return configured
  }
  if (compact) {
    return Math.min(total, 2)
  }
  return total
}
