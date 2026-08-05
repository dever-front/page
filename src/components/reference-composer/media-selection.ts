import type {
  ReferenceMediaSelectionItem,
  ReferencePreviewMedia,
} from './types'

export function normalizeReferenceMediaSelectionItems(
  value: unknown
): ReferenceMediaSelectionItem[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: ReferenceMediaSelectionItem[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const current = item as Record<string, unknown>
    const url = String(current.url || '').trim()
    const index = Number(current.index || 0)
    if (!url && index <= 0) {
      continue
    }
    const key = index > 0 ? `index:${index}` : `url:${url}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push({
      url,
      index: index > 0 ? index : 0,
      usage: String(current.usage || '').trim() || undefined,
    })
  }
  return result
}

export function referenceMediaSelectionSignature(value: unknown) {
  return normalizeReferenceMediaSelectionItems(value)
    .map((item) => `${item.index}:${item.url}:${item.usage || ''}`)
    .join(',')
}

export function referencePreviewMediaIndex(
  media: ReferencePreviewMedia,
  position: number
) {
  return Number(media.index || 0) || position + 1
}

export function referenceMediaSelectionItem(
  media: ReferencePreviewMedia,
  position: number
): ReferenceMediaSelectionItem {
  return {
    url: media.url,
    index: referencePreviewMediaIndex(media, position),
  }
}

export function referenceMediaSelectionKey(
  item: ReferenceMediaSelectionItem
) {
  return `${item.index > 0 ? item.index : 0}:${item.url}`
}

export function referencePreviewMediaMatchesSelection(
  media: ReferencePreviewMedia,
  position: number,
  selection: ReferenceMediaSelectionItem
) {
  const selectedIndex = Number(selection.index || 0)
  const selectedURL = String(selection.url || '').trim()
  if (selectedIndex <= 0 && !selectedURL) {
    return false
  }
  if (
    selectedIndex > 0 &&
    referencePreviewMediaIndex(media, position) !== selectedIndex
  ) {
    return false
  }
  return !selectedURL || media.url === selectedURL
}

export function findReferencePreviewMediaIndex(
  media: ReferencePreviewMedia[],
  selection: ReferenceMediaSelectionItem
) {
  return media.findIndex((item, position) =>
    referencePreviewMediaMatchesSelection(item, position, selection)
  )
}

export function resolveReferencePreviewMediaSelections(
  media: ReferencePreviewMedia[],
  selections: ReferenceMediaSelectionItem[]
) {
  return selections.flatMap((selection) => {
    const mediaIndex = findReferencePreviewMediaIndex(media, selection)
    return mediaIndex >= 0
      ? [{ selection, media: media[mediaIndex], mediaIndex }]
      : []
  })
}
