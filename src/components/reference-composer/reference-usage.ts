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

function normalizeReferenceKind(value: unknown) {
  const kind = String(value || '')
    .trim()
    .toLowerCase()
  if (kind === 'music') return 'audio'
  if (kind === 'rich') return 'richtext'
  return kind
}
