import type { ReferenceUsageOption } from './types'

export function compatibleReferenceUsageOptions(
  options: ReferenceUsageOption[],
  kind: unknown
) {
  const normalizedKind = normalizeReferenceKind(kind)
  return options.filter((option) => {
    const acceptedKinds = (option.acceptedKinds || [])
      .map(normalizeReferenceKind)
      .filter(Boolean)
    if (acceptedKinds.length === 0) {
      return true
    }
    return normalizedKind ? acceptedKinds.includes(normalizedKind) : false
  })
}

export function normalizeReferenceKind(value: unknown) {
  const kind = String(value || '')
    .trim()
    .toLowerCase()
  if (kind === 'music') return 'audio'
  if (kind === 'rich') return 'richtext'
  return kind
}

export function referenceUsageAvailable(
  option: ReferenceUsageOption,
  counts: Record<string, number>
) {
  const maxFiles = Number(option.maxFiles || 0)
  return maxFiles <= 0 || (counts[option.key] || 0) < maxFiles
}
