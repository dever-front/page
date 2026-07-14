import type { JSONContent } from '@tiptap/core'
import type { ReferenceInput, ReferencePart, ReferenceType } from './types'

export function serializeReferenceDocument(
  document: JSONContent
): ReferenceInput {
  const parts: ReferencePart[] = []
  const blocks = document.content || []
  blocks.forEach((block, index) => {
    appendNodes(parts, block.content || [])
    if (index < blocks.length - 1) {
      appendText(parts, '\n')
    }
  })
  const normalized = trimBoundaryWhitespace(parts)
  return {
    text: normalized
      .map((part) => (part.type === 'text' ? part.text : `@${part.label}`))
      .join('')
      .trim(),
    content: { version: 1, parts: normalized },
  }
}

function trimBoundaryWhitespace(parts: ReferencePart[]) {
  const normalized = parts
    .filter((part) => part.type === 'reference' || part.text.length > 0)
    .map((part) => ({ ...part }))
  const first = normalized[0]
  if (first?.type === 'text') {
    first.text = first.text.trimStart()
    if (!first.text) {
      normalized.shift()
    }
  }
  const last = normalized[normalized.length - 1]
  if (last?.type === 'text') {
    last.text = last.text.trimEnd()
    if (!last.text) {
      normalized.pop()
    }
  }
  return normalized
}

function appendNodes(parts: ReferencePart[], nodes: JSONContent[]) {
  for (const node of nodes) {
    if (node.type === 'text') {
      appendText(parts, node.text || '')
      continue
    }
    if (node.type === 'hardBreak') {
      appendText(parts, '\n')
      continue
    }
    if (node.type === 'reference') {
      const refType = String(node.attrs?.refType || '')
      const refId = Number(node.attrs?.refId || 0)
      const label = String(node.attrs?.label || '').trim()
      if (isReferenceType(refType) && refId > 0 && label) {
        parts.push({
          type: 'reference',
          ref_type: refType,
          ref_id: refId,
          label,
          usage: String(node.attrs?.usage || '').trim() || undefined,
        })
      }
      continue
    }
    if (node.content) {
      appendNodes(parts, node.content)
    }
  }
}

function isReferenceType(value: string): value is ReferenceType {
  return ['message', 'artifact', 'upload_file', 'session'].includes(value)
}

function appendText(parts: ReferencePart[], text: string) {
  if (!text) {
    return
  }
  const last = parts[parts.length - 1]
  if (last?.type === 'text') {
    last.text += text
    return
  }
  parts.push({ type: 'text', text })
}
