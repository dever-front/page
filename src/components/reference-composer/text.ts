import type { JSONContent } from '@tiptap/core'
import type { ReferenceContent, ReferenceOption, ReferencePart } from './types'

type ReferenceMatch = {
  mention: string
  option: ReferenceOption
}

export function referenceMentionLabel(label: string, trigger = '@') {
  const normalizedTrigger = referenceTrigger(trigger)
  const value = referenceLabel(label)
  return `${normalizedTrigger}${value}`
}

export function referenceTrigger(value: string | undefined) {
  const trigger = String(value || '').trim()
  return trigger.length === 1 ? trigger : '@'
}

export function referenceLabel(value: string) {
  return String(value || '')
    .trim()
    .replace(/^[@#]/, '')
}

export function referenceContentFromText(
  value: string,
  references: ReferenceOption[]
): ReferenceContent {
  const text = String(value || '')
  const matches = referenceMatches(references)
  if (!text || matches.length === 0) {
    return {
      version: 1,
      parts: text ? [{ type: 'text', text }] : [],
    }
  }

  const parts: ReferencePart[] = []
  let cursor = 0
  while (cursor < text.length) {
    const match = nextReferenceMatch(text, cursor, matches)
    if (!match) {
      appendText(parts, text.slice(cursor))
      break
    }
    if (match.index > cursor) {
      appendText(parts, text.slice(cursor, match.index))
    }
    parts.push({
      type: 'reference',
      ref_type: match.item.option.refType,
      ref_id: match.item.option.refId,
      label: referenceLabel(match.item.option.label),
      usage: match.item.option.usage,
      ref_trigger: referenceTrigger(match.item.option.trigger),
      ref_version_id: match.item.option.versionID,
      ref_origin: match.item.option.origin,
      ref_origin_id: match.item.option.originID,
    })
    cursor = match.index + match.item.mention.length
  }
  return { version: 1, parts }
}

export function referenceDocumentFromText(
  value: string,
  references: ReferenceOption[]
): JSONContent {
  const content = referenceContentFromText(value, references)
  return referenceDocumentFromContent(content, references)
}

export function referenceDocumentFromContent(
  content: ReferenceContent,
  references: ReferenceOption[]
): JSONContent {
  const options = referenceOptionLookup(references)
  const paragraphs: JSONContent[][] = [[]]

  for (const part of content.parts) {
    if (part.type === 'reference') {
      const option = referenceOptionForPart(options, part)
      paragraphs[paragraphs.length - 1].push({
        type: 'reference',
        attrs: {
          refType: part.ref_type,
          refId: part.ref_id,
          label: referenceLabel(option?.label || part.label),
          usage: part.usage || '',
          trigger: referenceTrigger(part.ref_trigger || option?.trigger),
          versionId: option?.versionID || part.ref_version_id || 0,
          previewText: option?.preview?.text || option?.description || '',
          previewKind: option?.preview?.kind || '',
          previewUrl: option?.preview?.url || '',
          origin: part.ref_origin || option?.origin || '',
          originId: part.ref_origin_id || option?.originID || '',
        },
      })
      continue
    }
    const lines = part.text.split('\n')
    lines.forEach((line, index) => {
      if (line) {
        paragraphs[paragraphs.length - 1].push({ type: 'text', text: line })
      }
      if (index < lines.length - 1) {
        paragraphs.push([])
      }
    })
  }

  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: paragraph.length > 0 ? paragraph : undefined,
    })),
  }
}

type ReferenceOptionLookup = {
  exact: Map<string, ReferenceOption>
  origin: Map<string, ReferenceOption>
  target: Map<string, ReferenceOption>
}

function referenceOptionLookup(
  references: ReferenceOption[]
): ReferenceOptionLookup {
  const lookup: ReferenceOptionLookup = {
    exact: new Map(),
    origin: new Map(),
    target: new Map(),
  }
  for (const option of references) {
    lookup.exact.set(referenceTargetKey(option), option)
    lookup.target.set(referenceBaseTargetKey(option.refType, option.refId), option)
    if (option.originID) {
      lookup.origin.set(
        referenceOriginTargetKey(
          option.refType,
          option.refId,
          option.origin,
          option.originID
        ),
        option
      )
    }
  }
  return lookup
}

function referenceOptionForPart(
  lookup: ReferenceOptionLookup,
  part: Extract<ReferencePart, { type: 'reference' }>
) {
  return (
    lookup.exact.get(referencePartTargetKey(part)) ||
    (part.ref_origin_id
      ? lookup.origin.get(
          referenceOriginTargetKey(
            part.ref_type,
            part.ref_id,
            part.ref_origin,
            part.ref_origin_id
          )
        )
      : undefined) ||
    lookup.target.get(referenceBaseTargetKey(part.ref_type, part.ref_id))
  )
}

function referenceMatches(references: ReferenceOption[]) {
  const matches = new Map<string, ReferenceMatch>()
  for (const option of references) {
    const mention = referenceMentionLabel(option.label, option.trigger)
    if (mention.length > 1 && !matches.has(mention)) {
      matches.set(mention, { mention, option })
    }
  }
  return [...matches.values()].sort(
    (left, right) => right.mention.length - left.mention.length
  )
}

function nextReferenceMatch(
  text: string,
  cursor: number,
  matches: ReferenceMatch[]
) {
  let selected:
    | {
        index: number
        item: ReferenceMatch
      }
    | undefined
  for (const item of matches) {
    const index = text.indexOf(item.mention, cursor)
    if (index < 0) {
      continue
    }
    if (
      !selected ||
      index < selected.index ||
      (index === selected.index &&
        item.mention.length > selected.item.mention.length)
    ) {
      selected = { index, item }
    }
  }
  return selected
}

function referenceTargetKey(option: ReferenceOption) {
  return option.originID
    ? `${option.refType}:${option.refId}:${option.versionID || 0}:${option.origin || ''}:${option.originID}`
    : `${option.refType}:${option.refId}:${option.versionID || 0}`
}

function referencePartTargetKey(
  part: Extract<ReferencePart, { type: 'reference' }>
) {
  return part.ref_origin_id
    ? `${part.ref_type}:${part.ref_id}:${part.ref_version_id || 0}:${part.ref_origin || ''}:${part.ref_origin_id}`
    : `${part.ref_type}:${part.ref_id}:${part.ref_version_id || 0}`
}

function referenceOriginTargetKey(
  refType: ReferenceOption['refType'],
  refId: number,
  origin?: string,
  originID?: string
) {
  return `${refType}:${refId}:${origin || ''}:${originID || ''}`
}

function referenceBaseTargetKey(
  refType: ReferenceOption['refType'],
  refId: number
) {
  return `${refType}:${refId}`
}

function appendText(parts: ReferencePart[], text: string) {
  if (!text) {
    return
  }
  const previous = parts[parts.length - 1]
  if (previous?.type === 'text') {
    previous.text += text
    return
  }
  parts.push({ type: 'text', text })
}
