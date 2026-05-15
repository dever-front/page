import type { UploadFileItem } from '@/lib/upload'

export type AssistantReferenceFile = {
  id?: string
  name: string
  type: string
  size: number
  kind: 'image' | 'text' | 'file'
  text?: string
  data_url?: string
  url?: string
  open_url?: string
  thumbnail?: string
}

const MAX_REFERENCE_TEXT_LENGTH = 8000
const MAX_REFERENCE_IMAGE_BYTES = 1024 * 1024

export function buildAssistantReferenceSummary(
  references?: AssistantReferenceFile[]
) {
  const items = normalizeAssistantReferences(references)
  if (items.length === 0) {
    return ''
  }

  const rows = items.map((file, index) => {
    const base = `${index + 1}. ${file.name} (${file.type || file.kind}, ${file.size} bytes)`
    const url = file.open_url || file.url || file.thumbnail || ''
    const location = url ? `\n资源地址: ${url}` : ''
    if (file.text) {
      return `${base}${location}\n${file.text}`
    }
    if (file.kind === 'image') {
      return file.data_url
        ? `${base}${location}\n这是一张参考图片，图片内容已随 task.reference_files 提供。`
        : `${base}${location}\n这是一张参考图片，当前只提供了文件元信息。`
    }
    return `${base}${location}`
  })
  return `参考材料：\n${rows.join('\n\n')}`
}

export function buildAssistantReferenceMessage(
  text: string,
  references?: AssistantReferenceFile[]
) {
  const items = normalizeAssistantReferences(references)
  if (items.length === 0) {
    return text
  }
  const rows = items.map((file) => `- ${file.name}`).join('\n')
  return `${text}\n\n参考资料:\n${rows}`
}

export function assistantReferencePayload(
  references?: AssistantReferenceFile[]
) {
  const items = normalizeAssistantReferences(references)
  return items.length > 0 ? items : undefined
}

export function normalizeAssistantReferences(
  references?: AssistantReferenceFile[]
) {
  return Array.isArray(references) ? references.filter(Boolean) : []
}

export async function readAssistantReferenceFile(
  file: File
): Promise<AssistantReferenceFile> {
  const kind = resolveAssistantReferenceKind(file.name, file.type)
  const base = {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    kind,
  }

  if (kind === 'text') {
    const text = await file.slice(0, MAX_REFERENCE_TEXT_LENGTH * 4).text()
    return {
      ...base,
      text: trimAssistantReferenceText(text),
    }
  }

  if (kind === 'image' && file.size <= MAX_REFERENCE_IMAGE_BYTES) {
    return {
      ...base,
      data_url: await readFileAsDataURL(file),
    }
  }

  return base
}

export function uploadItemToAssistantReferenceFile(
  item: UploadFileItem
): AssistantReferenceFile {
  const url = item.open_url || item.url || item.download || item.thumbnail || ''
  return {
    id: String(item.id || url || item.name || ''),
    name: item.name || resolveAssistantReferenceName(url),
    type: item.mime || item.ext || 'resource',
    size: Number(item.size || 0),
    kind: resolveAssistantReferenceKind(item.name || item.ext || url, item.mime),
    url,
    open_url: item.open_url,
    thumbnail: item.thumbnail,
  }
}

export function resolveAssistantReferenceKind(
  nameValue: string,
  typeValue?: string
): AssistantReferenceFile['kind'] {
  const type = String(typeValue || '').toLowerCase()
  const name = String(nameValue || '').toLowerCase()
  if (type.startsWith('image/') || isImageName(name)) {
    return 'image'
  }
  if (
    type.startsWith('text/') ||
    type.includes('json') ||
    ['.txt', '.md', '.csv', '.json', '.log'].some((suffix) => name.endsWith(suffix))
  ) {
    return 'text'
  }
  return 'file'
}

export function assistantReferenceKindText(file: AssistantReferenceFile) {
  if (file.kind === 'text') {
    return file.text ? '已读取文本' : '文本资料'
  }
  if (file.kind === 'image') {
    return file.data_url ? '参考图片' : '图片资源'
  }
  return file.url ? '资源文件' : '参考文件'
}

export function formatAssistantReferenceSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B'
  }
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function trimAssistantReferenceText(text: string) {
  const content = String(text || '').trim()
  if (content.length <= MAX_REFERENCE_TEXT_LENGTH) {
    return content
  }
  return `${content.slice(0, MAX_REFERENCE_TEXT_LENGTH)}\n...`
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function resolveAssistantReferenceName(url: string) {
  const parts = String(url || '').split('/').filter(Boolean)
  return parts[parts.length - 1] || '参考资料'
}

function isImageName(name: string) {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].some((suffix) =>
    name.endsWith(suffix)
  )
}
