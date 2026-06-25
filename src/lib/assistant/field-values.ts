import {
  markdownToRichTextDoc,
  parseRichTextDoc,
  serializeRichTextDoc,
} from '@/lib/rich-text'
import type { AssistantFieldContext } from './context'

export function normalizeAssistantFieldValue(
  field: AssistantFieldContext | undefined,
  value: unknown
): unknown {
  if (!field || !shouldConvertMarkdownToRichText(field)) {
    return value
  }

  const rich = parseRichTextDoc(value)
  if (rich) {
    return serializeRichTextDoc(rich)
  }

  const markdown = assistantMarkdownText(value)
  return serializeRichTextDoc(markdownToRichTextDoc(markdown))
}

export function normalizeAssistantFieldValues(
  fields: AssistantFieldContext[],
  values: Record<string, unknown>
) {
  const result: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(values || {})) {
    const field = findAssistantField(fields, path)
    result[path] = normalizeAssistantFieldValue(field, value)
  }
  return result
}

export function findAssistantField(
  fields: AssistantFieldContext[] | undefined,
  path: string
) {
  const target = normalizeAssistantFieldPath(path)
  return (fields || []).find((field) => normalizeAssistantFieldPath(field.path) === target)
}

function shouldConvertMarkdownToRichText(field: AssistantFieldContext) {
  return field.type === 'form-editor' && field.contentFormat !== 'markdown'
}

function assistantMarkdownText(value: unknown): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(assistantMarkdownText).filter(Boolean).join('\n\n')
  }
  if (typeof value !== 'object') {
    return String(value)
  }
  const row = value as Record<string, unknown>
  const content =
    row.content && typeof row.content === 'object' && !Array.isArray(row.content)
      ? (row.content as Record<string, unknown>)
      : null
  return firstText(row.text, content?.text, row.markdown, content?.markdown)
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }
    const text = value.trim()
    if (text) {
      return text
    }
  }
  return ''
}

function normalizeAssistantFieldPath(path: string) {
  return String(path || '')
    .trim()
    .replace(/^data\.form\./, 'form.')
    .replace(/^data\./, '')
}
