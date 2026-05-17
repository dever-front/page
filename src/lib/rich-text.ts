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

export function parseRichTextDoc(value: unknown): RichTextNode | null {
  if (isRichTextDoc(value)) {
    return value
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
    return isRichTextDoc(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function serializeRichTextDoc(value: unknown): string {
  const doc = isRichTextDoc(value) ? value : parseRichTextDoc(value)
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

function isRichTextDoc(value: unknown): value is RichTextNode {
  if (!isRecord(value) || value.type !== 'doc') {
    return false
  }
  return value.content == null || Array.isArray(value.content)
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
  if (node.type === 'text') {
    return !!String(node.text || '').trim()
  }
  return Array.isArray(node.content) && node.content.some(hasVisibleRichText)
}

function isRecord(value: unknown): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
