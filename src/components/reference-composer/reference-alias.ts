import type { Editor } from '@tiptap/core'

export type ReferenceAliasEntry = {
  key: string
  kind?: string
  deferred?: boolean
  count?: number
}

type ReferenceAliasDocument = Editor['state']['doc']

const REFERENCE_ALIAS_PREFIX: Record<string, string> = {
  image: '图',
  video: '视频',
  audio: '音频',
  file: '文件',
}

const documentAliasCache = new WeakMap<
  object,
  ReadonlyMap<number, string>
>()

// Aliases follow request order. Repeating the same concrete media selection
// keeps its alias, while a multi-media selection reserves its full index span.
export function referenceMediaAliases(entries: ReferenceAliasEntry[]) {
  const counters = new Map<string, number>()
  const aliases = new Map<string, string>()
  const result = Array.from({ length: entries.length }, () => '')

  for (const deferred of [false, true]) {
    entries.forEach((entry, entryIndex) => {
      if (Boolean(entry.deferred) !== deferred) {
        return
      }
      const kind = normalizeReferenceAliasKind(entry.kind)
      const prefix = REFERENCE_ALIAS_PREFIX[kind]
      if (!prefix || !entry.key) {
        return
      }
      const key = `${kind}:${entry.key}`
      const existing = aliases.get(key)
      if (existing) {
        result[entryIndex] = existing
        return
      }
      const startIndex = (counters.get(kind) || 0) + 1
      const endIndex =
        startIndex + normalizeReferenceAliasCount(entry.count) - 1
      counters.set(kind, endIndex)
      const alias =
        startIndex === endIndex
          ? `${prefix}${startIndex}`
          : `${prefix}${startIndex}-${prefix}${endIndex}`
      aliases.set(key, alias)
      result[entryIndex] = alias
    })
  }

  return result
}

export function referenceMediaAliasAtPosition(
  document: ReferenceAliasDocument,
  position: number
) {
  let aliases = documentAliasCache.get(document)
  if (!aliases) {
    const positions: number[] = []
    const entries: ReferenceAliasEntry[] = []
    document.descendants((node, nodePosition) => {
      if (node.type.name !== 'reference') {
        return
      }
      positions.push(nodePosition)
      entries.push({
        key: referenceAliasTargetKey(node.attrs),
        kind: referenceAliasKind(node.attrs),
        count: referenceAliasMediaCount(node.attrs),
        deferred:
          String(node.attrs.origin || '').trim().toLowerCase() === 'edge',
      })
    })
    const calculated = referenceMediaAliases(entries)
    aliases = new Map(
      positions.map((nodePosition, index) => [
        nodePosition,
        calculated[index] || '',
      ])
    )
    documentAliasCache.set(document, aliases)
  }
  return aliases.get(position) || ''
}

export function referenceAliasTargetKey(value: {
  refType?: unknown
  refId?: unknown
  versionId?: unknown
  usage?: unknown
  mediaURL?: unknown
  mediaUrl?: unknown
  mediaIndex?: unknown
  mediaItems?: unknown
}) {
  return JSON.stringify([
    String(value.refType || ''),
    Number(value.refId || 0),
    Number(value.versionId || 0),
    String(value.usage || '').trim().toLowerCase(),
    referenceAliasMediaSelectionKey(value),
  ])
}

export function referenceAliasMediaCount(value: {
  mediaURL?: unknown
  mediaUrl?: unknown
  mediaIndex?: unknown
  mediaCount?: unknown
  mediaItems?: unknown
}) {
  const selectedItems = normalizeReferenceAliasMediaItems(value.mediaItems)
  if (selectedItems.length > 0) {
    return selectedItems.length
  }
  if (
    String(value.mediaURL || value.mediaUrl || '').trim() ||
    normalizeReferenceAliasIndex(value.mediaIndex) > 0
  ) {
    return 1
  }
  return normalizeReferenceAliasCount(value.mediaCount)
}

export function referenceAliasKind(value: {
  kind?: unknown
  previewKind?: unknown
  usage?: unknown
  label?: unknown
  mediaURL?: unknown
  mediaUrl?: unknown
  previewURL?: unknown
  previewUrl?: unknown
}) {
  const explicitKind = normalizeReferenceAliasKind(
    value.kind || value.previewKind,
  )
  if (explicitKind && explicitKind !== 'file') {
    return explicitKind
  }

  const mediaKind = referenceAliasKindFromFileName(
    value.mediaURL,
    value.mediaUrl,
    value.previewURL,
    value.previewUrl,
    value.label,
  )
  if (mediaKind) {
    return mediaKind
  }

  const usage = String(value.usage || '').trim().toLowerCase()
  if (/audio|voice|music|sound|音频|声音|音乐/.test(usage)) {
    return 'audio'
  }
  if (/video|movie|视频/.test(usage)) {
    return 'video'
  }
  if (
    /image|picture|photo|first.?frame|last.?frame|start.?frame|end.?frame|图片|图像|首帧|尾帧/.test(
      usage,
    )
  ) {
    return 'image'
  }
  return explicitKind
}

function referenceAliasMediaSelectionKey(value: {
  mediaURL?: unknown
  mediaUrl?: unknown
  mediaIndex?: unknown
  mediaItems?: unknown
}) {
  const selectedItems = normalizeReferenceAliasMediaItems(value.mediaItems)
  if (selectedItems.length > 0) {
    return selectedItems
  }
  return [
    String(value.mediaURL || value.mediaUrl || '').trim(),
    normalizeReferenceAliasIndex(value.mediaIndex),
  ]
}

function normalizeReferenceAliasMediaItems(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return []
    }
    const current = item as Record<string, unknown>
    const url = String(current.url || '').trim()
    const index = normalizeReferenceAliasIndex(current.index)
    if (!url && index <= 0) {
      return []
    }
    return [
      [url, index, String(current.usage || '').trim().toLowerCase()],
    ]
  })
}

function normalizeReferenceAliasCount(value: unknown) {
  const count = Math.trunc(Number(value || 0))
  return Number.isFinite(count) && count > 0 ? count : 1
}

function normalizeReferenceAliasIndex(value: unknown) {
  const index = Math.trunc(Number(value || 0))
  return Number.isFinite(index) && index > 0 ? index : 0
}

function referenceAliasKindFromFileName(...values: unknown[]) {
  const source = values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
  if (/\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)(?:$|[?#\s])/.test(source)) {
    return 'image'
  }
  if (/\.(?:avi|m4v|mkv|mov|mp4|mpe?g|mpg|ts|webm)(?:$|[?#\s])/.test(source)) {
    return 'video'
  }
  if (/\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav)(?:$|[?#\s])/.test(source)) {
    return 'audio'
  }
  return ''
}

function normalizeReferenceAliasKind(value: unknown) {
  const kind = String(value || '').trim().toLowerCase()
  if (
    kind === 'img' ||
    kind === 'picture' ||
    kind === 'photo' ||
    kind.startsWith('image/')
  ) {
    return 'image'
  }
  if (
    kind === 'voice' ||
    kind === 'music' ||
    kind === 'sound' ||
    kind.startsWith('audio/')
  ) {
    return 'audio'
  }
  if (kind === 'movie' || kind.startsWith('video/')) {
    return 'video'
  }
  return kind
}
