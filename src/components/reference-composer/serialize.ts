import type { JSONContent } from '@tiptap/core'
import {
  referenceLabel,
  referenceMentionLabel,
  referenceTrigger,
} from './text'
import type { ReferenceInput, ReferencePart, ReferenceType } from './types'
import { normalizeReferenceMediaSelectionItems } from './media-selection'

export function serializeReferenceDocument(
  document: JSONContent,
  options: { trimBoundary?: boolean } = {}
): ReferenceInput {
  const parts: ReferencePart[] = []
  const blocks = document.content || []
  blocks.forEach((block, index) => {
    appendNodes(parts, block.content || [])
    if (index < blocks.length - 1) {
      appendText(parts, '\n')
    }
  })
  const normalized =
    options.trimBoundary === false ? parts : trimBoundaryWhitespace(parts)
  return {
    text: normalized
      .map((part) =>
        part.type === 'text'
          ? part.text
          : referenceMentionLabel(part.label, part.ref_trigger)
      )
      .join(''),
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
      const label = referenceLabel(String(node.attrs?.label || ''))
      const trigger = referenceTrigger(String(node.attrs?.trigger || ''))
      const versionID = Number(node.attrs?.versionId || 0)
      const mediaIndex = Number(node.attrs?.mediaIndex || 0)
      const mediaCount = Number(node.attrs?.mediaCount || 0)
      const mediaItems = normalizeReferenceMediaSelectionItems(
        node.attrs?.mediaItems
      )
      if (isReferenceType(refType) && refId > 0 && label) {
        parts.push({
          type: 'reference',
          ref_type: refType,
          ref_id: refId,
          label,
          usage: String(node.attrs?.usage || '').trim() || undefined,
          purpose: String(node.attrs?.purpose || '').trim() || undefined,
          ref_trigger: trigger,
          ref_version_id: versionID > 0 ? versionID : undefined,
          ref_origin: String(node.attrs?.origin || '').trim() || undefined,
          ref_origin_id:
            String(node.attrs?.originId || '').trim() || undefined,
          ref_media_url:
            String(node.attrs?.mediaUrl || '').trim() || undefined,
          ref_media_index: mediaIndex > 0 ? mediaIndex : undefined,
          ref_media_count: mediaCount > 0 ? mediaCount : undefined,
          ref_media_items: mediaItems.length > 0 ? mediaItems : undefined,
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
  return [
    'message',
    'artifact',
    'upload_file',
    'session',
    'canvas_node',
    'asset',
    'material',
  ].includes(value)
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
