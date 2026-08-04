export type ReferenceAliasEntry = {
  key: string
  kind?: string
  deferred?: boolean
}

const REFERENCE_ALIAS_PREFIX: Record<string, string> = {
  image: '图',
  video: '视频',
  audio: '音频',
  file: '文件',
}

// Aliases are derived from the current request order. Repeated references keep
// the same alias, so mentioning one asset more than once does not renumber it.
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
      const index = (counters.get(kind) || 0) + 1
      counters.set(kind, index)
      const alias = `${prefix}${index}`
      aliases.set(key, alias)
      result[entryIndex] = alias
    })
  }

  return result
}

export function referenceAliasTargetKey(value: {
  refType?: unknown
  refId?: unknown
  versionId?: unknown
  usage?: unknown
}) {
  return [
    String(value.refType || ''),
    Number(value.refId || 0),
    Number(value.versionId || 0),
    String(value.usage || '').trim().toLowerCase(),
  ].join(':')
}

function normalizeReferenceAliasKind(value: unknown) {
  const kind = String(value || '').trim().toLowerCase()
  if (kind === 'img' || kind === 'picture') {
    return 'image'
  }
  if (kind === 'voice') {
    return 'audio'
  }
  return kind
}
