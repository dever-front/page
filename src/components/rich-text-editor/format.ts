import type { Editor, JSONContent } from '@tiptap/core'
import { emptyRichTextDoc, parseRichTextDoc, serializeRichTextDoc } from '@/lib/rich-text'

export type RichTextContentFormat = 'json' | 'markdown'
export type RichTextEditorContent = JSONContent | string
type MarkdownCapableEditor = Editor & {
  getMarkdown?: () => string
}

export function resolveRichTextContentFormat(value: unknown): RichTextContentFormat {
  return value === 'markdown' ? 'markdown' : 'json'
}

export function parseRichTextEditorContent(
  value: unknown,
  format: RichTextContentFormat
): RichTextEditorContent {
  if (format === 'markdown') {
    return textValue(value)
  }

  return parseEditorJsonDoc(value)
}

export function serializeRichTextEditorContent(
  editor: Editor,
  format: RichTextContentFormat
) {
  if (format === 'markdown') {
    return typeof (editor as MarkdownCapableEditor).getMarkdown === 'function'
      ? (editor as MarkdownCapableEditor).getMarkdown!()
      : ''
  }

  return serializeRichTextDoc(editor.getJSON())
}

export function normalizeRichTextEditorValue(
  value: unknown,
  format: RichTextContentFormat
) {
  if (format === 'markdown') {
    return textValue(value)
  }

  return serializeRichTextDoc(parseEditorJsonDoc(value))
}

export function inputValue(value: unknown) {
  if (value == null) {
    return ''
  }
  return typeof value === 'string' ? value.trim() : JSON.stringify(value) || ''
}

function textValue(value: unknown) {
  if (value == null) {
    return ''
  }
  return typeof value === 'string' ? value : JSON.stringify(value) || ''
}

function parseEditorJsonDoc(value: unknown) {
  const doc = parseRichTextDoc(value)
  if (doc) {
    return doc
  }

  const text = inputValue(value)
  if (!text) {
    return emptyRichTextDoc()
  }

  return {
    type: 'doc',
    content: text.split(/\r?\n/).map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : undefined,
    })),
  } satisfies JSONContent
}
