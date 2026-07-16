import type { JSONContent } from '@tiptap/core'
import type { ReferenceContent, ReferenceOption, ReferencePart } from './types'

type ReferenceMatch = {
  mention: string
  option: ReferenceOption
}

export function referenceMentionLabel(label: string) {
  const value = String(label || '').trim()
  return value.startsWith('@') ? value : `@${value}`
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
      label: match.item.mention,
      usage: match.item.option.usage,
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
  const options = new Map(
    references.map((option) => [referenceTargetKey(option), option])
  )
  const paragraphs: JSONContent[][] = [[]]

  for (const part of content.parts) {
    if (part.type === 'reference') {
      const option = options.get(`${part.ref_type}:${part.ref_id}`)
      paragraphs[paragraphs.length - 1].push({
        type: 'reference',
        attrs: {
          refType: part.ref_type,
          refId: part.ref_id,
          label: option?.label || part.label,
          usage: part.usage || '',
          previewText: option?.preview?.text || option?.description || '',
          previewKind: option?.preview?.kind || '',
          previewUrl: option?.preview?.url || '',
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

function referenceMatches(references: ReferenceOption[]) {
  const matches = new Map<string, ReferenceMatch>()
  for (const option of references) {
    const mention = referenceMentionLabel(option.label)
    if (mention !== '@' && !matches.has(mention)) {
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
  return `${option.refType}:${option.refId}`
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
