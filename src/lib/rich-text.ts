export type RichTextMark = {
  type: string
  attrs?: Record<string, any>
}

export type RichTextNode = {
  type: string
  attrs?: Record<string, any>
  content?: RichTextNode[]
  marks?: RichTextMark[]
  text?: string
}

export type RichTextMediaKind = 'image' | 'video' | 'audio'

export const richTextMediaNodeNames: Record<RichTextMediaKind, string> = {
  image: 'editorMediaImage',
  video: 'editorMediaVideo',
  audio: 'editorMediaAudio',
}

export const richTextExternalMediaNodeName = 'editorMediaEmbed'

const richTextNodeAliases: Record<string, string> = {
  audio: richTextMediaNodeNames.audio,
  editorMediaExternal: richTextExternalMediaNodeName,
  externalMedia: richTextExternalMediaNodeName,
  image: richTextMediaNodeNames.image,
  mediaAudio: richTextMediaNodeNames.audio,
  mediaEmbed: richTextExternalMediaNodeName,
  mediaExternal: richTextExternalMediaNodeName,
  mediaImage: richTextMediaNodeNames.image,
  mediaVideo: richTextMediaNodeNames.video,
  video: richTextMediaNodeNames.video,
}

export function parseRichTextDoc(value: unknown): RichTextNode | null {
  if (isRichTextDoc(value)) {
    return normalizeRichTextDoc(value)
  }
  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()
  if (!text) {
    return null
  }

  try {
    const parsed = JSON.parse(text)
    return isRichTextDoc(parsed) ? normalizeRichTextDoc(parsed) : null
  } catch {
    return null
  }
}

export function serializeRichTextDoc(value: unknown): string {
  const doc = parseRichTextDoc(value)
  if (isEmptyRichTextDoc(doc)) {
    return ''
  }
  return JSON.stringify(doc)
}

export function isEmptyRichTextDoc(doc: RichTextNode | null | undefined): boolean {
  if (!doc || doc.type !== 'doc') {
    return true
  }
  return !hasVisibleRichText(doc)
}

export function normalizeRichTextMaxWidth(value: unknown): string {
  const text = String(value || '').trim()
  if (/^\d+(\.\d+)?%$/.test(text) || /^\d+(\.\d+)?px$/.test(text)) {
    return text
  }
  return ''
}

export function defaultRichTextMediaMaxWidth(kind: RichTextMediaKind): string {
  switch (kind) {
    case 'image':
    case 'video':
      return '50%'
    case 'audio':
      return '384px'
  }
}

export function richTextMediaSources(
  doc: RichTextNode | null | undefined,
  kind: RichTextMediaKind
): string[] {
  if (!doc) {
    return []
  }
  const result: string[] = []
  collectRichTextMediaSources(doc, richTextMediaNodeNames[kind], result)
  return uniqueStrings(result)
}

function isRichTextDoc(value: unknown): value is RichTextNode {
  if (!isRecord(value) || value.type !== 'doc') {
    return false
  }
  return value.content == null || Array.isArray(value.content)
}

function normalizeRichTextDoc(doc: RichTextNode): RichTextNode {
  return {
    type: 'doc',
    attrs: normalizeAttrs(doc.attrs),
    content: normalizeRichTextContent(doc.content),
  }
}

export function emptyRichTextDoc(): RichTextNode {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }
}

export function markdownToRichTextDoc(value: unknown): RichTextNode {
  const text = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    return emptyRichTextDoc()
  }
  const content = markdownBlocksToRichText(text)
  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  }
}

export function richTextDocToMarkdown(value: unknown): string {
  const doc = parseRichTextDoc(value)
  if (!doc) {
    return typeof value === 'string' ? value : ''
  }
  return richTextNodeToMarkdown(doc).trim()
}

function hasVisibleRichText(node: RichTextNode): boolean {
  if (node.type === richTextMediaNodeNames.image) {
    return !!String(node.attrs?.src || '').trim()
  }
  if (node.type === richTextMediaNodeNames.video) {
    return !!String(node.attrs?.src || '').trim()
  }
  if (node.type === richTextMediaNodeNames.audio) {
    return !!String(node.attrs?.src || '').trim()
  }
  if (node.type === richTextExternalMediaNodeName) {
    return !!String(node.attrs?.src || node.attrs?.href || '').trim()
  }
  if (node.type === 'agentAbilityPlaceholder' || node.type === 'agentTaskPlaceholder') {
    return true
  }
  if (node.type === 'text') {
    return !!String(node.text || '').trim()
  }
  return Array.isArray(node.content) && node.content.some(hasVisibleRichText)
}

function collectRichTextMediaSources(
  node: RichTextNode,
  mediaType: string,
  result: string[]
) {
  if (node.type === mediaType) {
    const src = String(node.attrs?.src || '').trim()
    if (src) {
      result.push(src)
    }
  }
  if (Array.isArray(node.content)) {
    node.content.forEach((child) =>
      collectRichTextMediaSources(child, mediaType, result)
    )
  }
}

function normalizeRichTextContent(content: unknown): RichTextNode[] {
  if (!Array.isArray(content)) {
    return []
  }
  return content
    .map(normalizeRichTextNode)
    .filter((node): node is RichTextNode => node != null)
}

function normalizeRichTextNode(value: unknown): RichTextNode | null {
  if (!isRecord(value)) {
    return null
  }
  const type = normalizeRichTextNodeType(value.type)
  if (!type) {
    return null
  }

  const node: RichTextNode = { type }
  const attrs = normalizeAttrs(value.attrs)
  if (attrs) {
    node.attrs = attrs
  }
  const marks = normalizeRichTextMarks(value.marks)
  if (marks.length > 0) {
    node.marks = marks
  }
  if (type === 'text') {
    node.text = String(value.text || '')
    return node.text ? node : null
  }
  const children = normalizeRichTextContent(value.content)
  if (children.length > 0) {
    node.content = children
  }
  return node
}

function normalizeRichTextNodeType(value: unknown) {
  const type = String(value || '').trim()
  return richTextNodeAliases[type] || type
}

function normalizeRichTextMarks(marks: unknown): RichTextMark[] {
  if (!Array.isArray(marks)) {
    return []
  }
  return marks
    .map((mark) => {
      if (!isRecord(mark)) {
        return null
      }
      const type = String(mark.type || '').trim()
      if (!type) {
        return null
      }
      const row: RichTextMark = { type }
      const attrs = normalizeAttrs(mark.attrs)
      if (attrs) {
        row.attrs = attrs
      }
      return row
    })
    .filter((mark): mark is RichTextMark => mark != null)
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    const text = String(value || '').trim()
    if (!text || seen.has(text)) {
      return
    }
    seen.add(text)
    result.push(text)
  })
  return result
}

function normalizeAttrs(value: unknown): Record<string, any> | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return value
}

function isRecord(value: unknown): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function markdownBlocksToRichText(text: string): RichTextNode[] {
  const lines = text.split('\n')
  const nodes: RichTextNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }

    const codeFence = trimmed.match(/^```([a-zA-Z0-9_-]*)\s*$/)
    if (codeFence) {
      const block = collectMarkdownCodeBlock(lines, index, codeFence[1])
      nodes.push(block.node)
      index = block.nextIndex
      continue
    }

    if (isMarkdownTableStart(lines, index)) {
      const block = collectMarkdownTable(lines, index)
      nodes.push(block.node)
      index = block.nextIndex
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      nodes.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: inlineRichTextNodes(heading[2].trim()),
      })
      index += 1
      continue
    }

    const image = parseStandaloneMarkdownImage(trimmed)
    if (image) {
      nodes.push({
        type: richTextMediaNodeNames.image,
        attrs: {
          src: image.src,
          alt: image.alt,
          title: image.title || image.alt,
        },
      })
      index += 1
      continue
    }

    if (isMarkdownBullet(trimmed)) {
      const block = collectMarkdownList(lines, index, 'bulletList')
      nodes.push(block.node)
      index = block.nextIndex
      continue
    }

    if (isMarkdownOrdered(trimmed)) {
      const block = collectMarkdownList(lines, index, 'orderedList')
      nodes.push(block.node)
      index = block.nextIndex
      continue
    }

    if (trimmed.startsWith('>')) {
      const block = collectMarkdownBlockquote(lines, index)
      nodes.push(block.node)
      index = block.nextIndex
      continue
    }

    const block = collectMarkdownParagraph(lines, index)
    nodes.push(paragraphNode(block.text))
    index = block.nextIndex
  }

  return nodes
}

function collectMarkdownCodeBlock(
  lines: string[],
  start: number,
  language: string
) {
  const content: string[] = []
  let index = start + 1
  while (index < lines.length) {
    if (lines[index].trim() === '```') {
      index += 1
      break
    }
    content.push(lines[index])
    index += 1
  }
  const attrs = language ? { language } : undefined
  return {
    nextIndex: index,
    node: {
      type: 'codeBlock',
      attrs,
      content: content.length
        ? [{ type: 'text', text: content.join('\n') }]
        : undefined,
    } as RichTextNode,
  }
}

function collectMarkdownTable(lines: string[], start: number) {
  const tableRows: RichTextNode[] = []
  const header = markdownTableCells(lines[start])
  tableRows.push(tableRowNode(header, true))
  let index = start + 2
  while (index < lines.length && isMarkdownTableRow(lines[index].trim())) {
    if (!isMarkdownTableSeparator(lines[index].trim())) {
      tableRows.push(tableRowNode(markdownTableCells(lines[index]), false))
    }
    index += 1
  }
  return {
    nextIndex: index,
    node: {
      type: 'table',
      content: tableRows,
    } as RichTextNode,
  }
}

function tableRowNode(cells: string[], header: boolean): RichTextNode {
  return {
    type: 'tableRow',
    content: cells.map((cell) => ({
      type: header ? 'tableHeader' : 'tableCell',
      content: [paragraphNode(cell)],
    })),
  }
}

function collectMarkdownList(
  lines: string[],
  start: number,
  type: 'bulletList' | 'orderedList'
) {
  const items: RichTextNode[] = []
  let index = start
  while (index < lines.length) {
    const trimmed = lines[index].trim()
    const match =
      type === 'bulletList'
        ? trimmed.match(/^[-*+]\s+(.+)$/)
        : trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (!match) {
      break
    }
    items.push({
      type: 'listItem',
      content: [paragraphNode(match[1].trim())],
    })
    index += 1
  }
  return {
    nextIndex: index,
    node: {
      type,
      content: items,
    } as RichTextNode,
  }
}

function collectMarkdownBlockquote(lines: string[], start: number) {
  const content: string[] = []
  let index = start
  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (!trimmed.startsWith('>')) {
      break
    }
    content.push(trimmed.replace(/^>\s?/, ''))
    index += 1
  }
  return {
    nextIndex: index,
    node: {
      type: 'blockquote',
      content: [paragraphNode(content.join('\n'))],
    } as RichTextNode,
  }
}

function collectMarkdownParagraph(lines: string[], start: number) {
  const content: string[] = []
  let index = start
  while (index < lines.length) {
    const current = lines[index]
    const trimmed = current.trim()
    if (!trimmed || isMarkdownBlockStart(lines, index)) {
      break
    }
    content.push(current)
    index += 1
  }
  return {
    nextIndex: index > start ? index : start + 1,
    text: content.join('\n').trim(),
  }
}

function paragraphNode(text: string): RichTextNode {
  const content = inlineRichTextNodes(text)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function inlineRichTextNodes(text: string): RichTextNode[] {
  const nodes: RichTextNode[] = []
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = tokenPattern.exec(text)) !== null) {
    appendPlainRichText(nodes, text.slice(lastIndex, match.index))
    nodes.push(markdownInlineTokenNode(match[0]))
    lastIndex = match.index + match[0].length
  }
  appendPlainRichText(nodes, text.slice(lastIndex))
  return nodes.filter((node) => node.text || node.type === 'hardBreak')
}

function appendPlainRichText(nodes: RichTextNode[], value: string) {
  const parts = value.split('\n')
  parts.forEach((part, index) => {
    if (index > 0) {
      nodes.push({ type: 'hardBreak' })
    }
    if (part) {
      nodes.push({ type: 'text', text: part })
    }
  })
}

function markdownInlineTokenNode(token: string): RichTextNode {
  const bold = token.match(/^\*\*([^*]+)\*\*$/)
  if (bold) {
    return { type: 'text', text: bold[1], marks: [{ type: 'bold' }] }
  }
  const italic = token.match(/^\*([^*]+)\*$/)
  if (italic) {
    return { type: 'text', text: italic[1], marks: [{ type: 'italic' }] }
  }
  const code = token.match(/^`([^`]+)`$/)
  if (code) {
    return { type: 'text', text: code[1], marks: [{ type: 'code' }] }
  }
  const link = token.match(/^\[([^\]]+)]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)$/)
  if (link) {
    return {
      type: 'text',
      text: link[1],
      marks: [{ type: 'link', attrs: { href: cleanMarkdownDestination(link[2]) } }],
    }
  }
  return { type: 'text', text: token }
}

function isMarkdownBlockStart(lines: string[], index: number) {
  const trimmed = lines[index].trim()
  return (
    /^```/.test(trimmed) ||
    /^(#{1,6})\s+/.test(trimmed) ||
    isMarkdownBullet(trimmed) ||
    isMarkdownOrdered(trimmed) ||
    trimmed.startsWith('>') ||
    Boolean(parseStandaloneMarkdownImage(trimmed)) ||
    isMarkdownTableStart(lines, index)
  )
}

function isMarkdownBullet(line: string) {
  return /^[-*+]\s+/.test(line)
}

function isMarkdownOrdered(line: string) {
  return /^\d+[.)]\s+/.test(line)
}

function parseStandaloneMarkdownImage(line: string) {
  const match = line.match(
    /^!\[([^\]]*)]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)$/
  )
  if (!match) {
    return null
  }
  return {
    alt: match[1].trim(),
    src: cleanMarkdownDestination(match[2]),
    title: String(match[3] || '').trim(),
  }
}

function isMarkdownTableStart(lines: string[], index: number) {
  return (
    index + 1 < lines.length &&
    isMarkdownTableRow(lines[index].trim()) &&
    isMarkdownTableSeparator(lines[index + 1].trim())
  )
}

function isMarkdownTableRow(line: string) {
  return line.includes('|') && markdownTableCells(line).length >= 2
}

function isMarkdownTableSeparator(line: string) {
  const cells = markdownTableCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function markdownTableCells(line: string) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function cleanMarkdownDestination(value: string) {
  return String(value || '').trim().replace(/^<|>$/g, '')
}

function richTextNodeToMarkdown(node: RichTextNode, index = 0): string {
  switch (node.type) {
    case 'doc':
      return richTextChildrenToMarkdown(node, '\n\n')
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(node.attrs?.level || 2)))
      return `${'#'.repeat(level)} ${richTextInlineMarkdown(node)}`
    }
    case 'paragraph':
      return richTextInlineMarkdown(node)
    case 'blockquote':
      return richTextChildrenToMarkdown(node, '\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'bulletList':
      return richTextListMarkdown(node, '-')
    case 'orderedList':
      return richTextListMarkdown(node, '', index)
    case 'listItem':
      return richTextChildrenToMarkdown(node, '\n')
    case 'codeBlock':
      return `\`\`\`${String(node.attrs?.language || '').trim()}\n${richTextText(node)}\n\`\`\``
    case 'table':
      return richTextTableMarkdown(node)
    case richTextMediaNodeNames.image:
      return `![${escapeMarkdownText(String(node.attrs?.alt || node.attrs?.title || '').trim())}](${String(node.attrs?.src || '').trim()})`
    case richTextMediaNodeNames.video:
      return richTextMediaLinkMarkdown(node, '视频')
    case richTextMediaNodeNames.audio:
      return richTextMediaLinkMarkdown(node, '音频')
    case richTextExternalMediaNodeName:
      return richTextMediaLinkMarkdown(node, '媒体')
    default:
      return richTextInlineMarkdown(node) || richTextChildrenToMarkdown(node, '\n\n')
  }
}

function richTextChildrenToMarkdown(node: RichTextNode, separator: string) {
  return (node.content || [])
    .map((child, index) => richTextNodeToMarkdown(child, index))
    .map((text) => text.trim())
    .filter(Boolean)
    .join(separator)
}

function richTextInlineMarkdown(node: RichTextNode): string {
  return (node.content || [])
    .map((child) => {
      if (child.type === 'text') {
        return richTextMarkedText(child)
      }
      if (child.type === 'hardBreak') {
        return '\n'
      }
      return richTextNodeToMarkdown(child)
    })
    .join('')
}

function richTextMarkedText(node: RichTextNode): string {
  let text = escapeMarkdownText(String(node.text || ''))
  for (const mark of node.marks || []) {
    if (mark.type === 'code') {
      text = `\`${text}\``
    } else if (mark.type === 'bold') {
      text = `**${text}**`
    } else if (mark.type === 'italic') {
      text = `*${text}*`
    } else if (mark.type === 'link') {
      const href = String(mark.attrs?.href || '').trim()
      if (href) {
        text = `[${text}](${href})`
      }
    }
  }
  return text
}

function richTextListMarkdown(
  node: RichTextNode,
  marker: string,
  startIndex = 0
) {
  return (node.content || [])
    .map((child, index) => {
      const prefix = marker || `${startIndex + index + 1}.`
      return `${prefix} ${richTextNodeToMarkdown(child).replace(/\n/g, '\n  ')}`
    })
    .join('\n')
}

function richTextTableMarkdown(node: RichTextNode) {
  const rows = (node.content || []).map((row) =>
    (row.content || []).map((cell) => richTextChildrenToMarkdown(cell, ' ').trim())
  )
  if (rows.length === 0) {
    return ''
  }
  const header = rows[0]
  const separator = header.map(() => '---')
  const body = rows.slice(1)
  return [header, separator, ...body]
    .map((row) => `| ${row.map(escapeMarkdownTableCell).join(' | ')} |`)
    .join('\n')
}

function richTextMediaLinkMarkdown(node: RichTextNode, fallback: string) {
  const src = String(node.attrs?.src || node.attrs?.href || '').trim()
  if (!src) {
    return ''
  }
  const label = String(node.attrs?.title || node.attrs?.caption || fallback).trim()
  return `[${escapeMarkdownText(label || fallback)}](${src})`
}

function richTextText(node: RichTextNode): string {
  if (node.type === 'text') {
    return String(node.text || '')
  }
  return (node.content || []).map(richTextText).join('')
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*_{}\[\]()#+.!|-])/g, '\\$1')
}

function escapeMarkdownTableCell(value: string) {
  return escapeMarkdownText(value).replace(/\|/g, '\\|')
}
