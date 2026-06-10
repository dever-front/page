import type { Editor, JSONContent } from '@tiptap/core'
import { emptyRichTextDoc, parseRichTextDoc, serializeRichTextDoc } from '@/lib/rich-text'
import { inferCodeBlockLanguage } from './code-language'

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
    return normalizeCodeBlockNodes(doc)
  }

  const text = inputValue(value)
  if (!text) {
    return emptyRichTextDoc()
  }
  const markdownDoc = parseMarkdownLikeTextDoc(text)
  if (markdownDoc) {
    return markdownDoc
  }

  return {
    type: 'doc',
    content: text.split(/\r?\n/).map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : undefined,
    })),
  } satisfies JSONContent
}

function normalizeCodeBlockNodes(node: JSONContent): JSONContent {
  const content = Array.isArray(node.content)
    ? node.content.map((current) => normalizeCodeBlockNodes(current))
    : node.content

  if (node.type !== 'codeBlock') {
    return content === node.content
      ? node
      : {
          ...node,
          content,
        }
  }

  const codeText = richTextNodeText({
    ...node,
    content,
  })
  const language = inferCodeBlockLanguage(codeText, node.attrs?.language)

  return {
    ...node,
    attrs: language
      ? {
          ...(node.attrs || {}),
          language,
        }
      : node.attrs,
    content: codeText ? [{ type: 'text', text: codeText }] : undefined,
  }
}

function richTextNodeText(node: JSONContent): string {
  if (typeof node.text === 'string') {
    return node.text
  }
  if (!Array.isArray(node.content)) {
    return ''
  }
  return node.content.map((current) => richTextNodeText(current)).join('')
}

function parseMarkdownLikeTextDoc(value: string): JSONContent | null {
  if (!looksLikeMarkdown(value)) {
    return null
  }

  const lines = normalizeMarkdownSource(value).split(/\r?\n/)
  const content: JSONContent[] = []
  let paragraph: string[] = []
  let codeLines: string[] = []
  let inCodeBlock = false
  let codeLanguage = ''
  let listType: 'bulletList' | 'orderedList' | '' = ''
  let listItems: string[] = []

  const flushParagraph = () => {
    const text = paragraph.join('\n').trim()
    paragraph = []
    if (!text) {
      return
    }
    content.push({
      type: 'paragraph',
      content: markdownInlineNodes(text),
    })
  }

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      return
    }
    content.push({
      type: listType,
      content: listItems.map((text) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: markdownInlineNodes(text),
          },
        ],
      })),
    })
    listType = ''
    listItems = []
  }

  const flushCodeBlock = () => {
    const codeText = codeLines.join('\n')
    const language = inferCodeBlockLanguage(codeText, codeLanguage)
    content.push({
      type: 'codeBlock',
      attrs: language ? { language } : undefined,
      content: codeLines.length ? [{ type: 'text', text: codeText }] : undefined,
    })
    codeLines = []
    codeLanguage = ''
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const fence = /^```\s*([a-zA-Z0-9_-]+)?\s*$/.exec(line)
    if (fence) {
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        flushParagraph()
        flushList()
        inCodeBlock = true
        codeLanguage = fence[1] || ''
        codeLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(rawLine)
      continue
    }

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    if (/^---+$/.test(line)) {
      flushParagraph()
      flushList()
      content.push({ type: 'horizontalRule' })
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      content.push({
        type: 'heading',
        attrs: { level: Math.min(3, heading[1].length) },
        content: markdownInlineNodes(heading[2]),
      })
      continue
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (bullet) {
      flushParagraph()
      if (listType && listType !== 'bulletList') {
        flushList()
      }
      listType = 'bulletList'
      listItems.push(bullet[1])
      continue
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(line)
    if (ordered) {
      flushParagraph()
      if (listType && listType !== 'orderedList') {
        flushList()
      }
      listType = 'orderedList'
      listItems.push(ordered[1])
      continue
    }

    flushList()
    paragraph.push(line)
  }

  if (inCodeBlock) {
    flushCodeBlock()
  }
  flushParagraph()
  flushList()

  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  }
}

function looksLikeMarkdown(value: string) {
  return /```/.test(value) ||
    /(^|\n)\s*#{1,6}\s+\S/.test(value) ||
    /(^|\n)\s*[-*]\s+\S/.test(value) ||
    /(^|\n)\s*\d+\.\s+\S/.test(value) ||
    /(^|\n)\s*---+\s*(\n|$)/.test(value)
}

function normalizeMarkdownSource(value: string) {
  const source = value.replace(/\r\n/g, '\n')
  const fencePattern = /```[ \t]*([a-zA-Z0-9_-]+)?[ \t]*(?:\n|$)?/g
  let result = ''
  let lastIndex = 0
  let inCodeBlock = false
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(source)) !== null) {
    const segment = source.slice(lastIndex, match.index)
    result += inCodeBlock ? segment : normalizeMarkdownTextSegment(segment)
    result = appendFenceLine(result, match[1] || '', inCodeBlock)
    inCodeBlock = !inCodeBlock
    lastIndex = fencePattern.lastIndex
  }

  const rest = source.slice(lastIndex)
  result += inCodeBlock ? rest : normalizeMarkdownTextSegment(rest)

  return result.trim()
}

function normalizeMarkdownTextSegment(value: string) {
  return value
    .replace(/[ \t]+(#{1,6})\s+/g, '\n\n$1 ')
    .replace(/[ \t]+(\d+\.\s+)/g, '\n$1')
    .replace(/[ \t]+([-*]\s+)/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
}

function appendFenceLine(value: string, language: string, isClosingFence: boolean) {
  let result = value
  if (isClosingFence) {
    return `${result}${result && !result.endsWith('\n') ? '\n' : ''}\`\`\`\n`
  }
  if (result) {
    result += result.endsWith('\n\n') ? '' : result.endsWith('\n') ? '\n' : '\n\n'
  }
  return `${result}\`\`\`${language}\n`
}

function markdownInlineNodes(value: string): JSONContent[] {
  const nodes: JSONContent[] = []
  const pattern = /(\*\*([^*]+)\*\*|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: value.slice(lastIndex, match.index) })
    }

    if (match[2]) {
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] })
    } else if (match[3]) {
      nodes.push({ type: 'text', text: match[3], marks: [{ type: 'strike' }] })
    } else if (match[4]) {
      nodes.push({ type: 'text', text: match[4], marks: [{ type: 'code' }] })
    } else if (match[5]) {
      nodes.push({ type: 'text', text: match[5], marks: [{ type: 'italic' }] })
    } else if (match[6] && match[7]) {
      nodes.push({
        type: 'text',
        text: match[6],
        marks: [{ type: 'link', attrs: { href: match[7] } }],
      })
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < value.length) {
    nodes.push({ type: 'text', text: value.slice(lastIndex) })
  }

  return nodes.length ? nodes : []
}
