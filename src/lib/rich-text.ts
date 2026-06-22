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
