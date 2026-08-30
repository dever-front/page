import { FileImage, Music4, Video } from 'lucide-react'
import {
  normalizeUploadItem,
  normalizeUploadItems,
  normalizeUploadUrlItems,
  type ResourceUploadRule,
} from '@/lib/resource'
import type { NodeItemProps } from '../../../nodes'

type UploadItemSchema = NodeItemProps['item']

export function resolveUploadItems(
  relationValue: unknown,
  value: unknown,
  multiple: boolean,
  saveMode: string,
  item: UploadItemSchema,
  uploadType: string
) {
  if (saveMode === 'url') {
    const urlItems = normalizeUploadUrlItems(value, {
      kind: item.meta?.kind,
      uploadType,
    })
    return multiple ? urlItems : urlItems.slice(0, 1)
  }

  const relationItems = normalizeUploadItems(relationValue)
  if (relationItems.length > 0) {
    return multiple ? relationItems : relationItems.slice(0, 1)
  }

  const valueItems = normalizeUploadItems(value)
  if (valueItems.length > 0) {
    return multiple ? valueItems : valueItems.slice(0, 1)
  }

  if (Array.isArray(value)) {
    return value
      .filter((current) => current && typeof current === 'object')
      .map((current) => normalizeUploadItem(current))
  }

  if (value && typeof value === 'object') {
    return [normalizeUploadItem(value)]
  }

  return []
}

export function resolveUploadSaveMode(item: UploadItemSchema) {
  return String(item.meta?.saveMode || '').trim().toLowerCase() === 'url' ? 'url' : 'id'
}

export function buildUploadRules(
  item: UploadItemSchema,
  resourceKind: string,
  ruleIdFromPath?: unknown
): ResourceUploadRule[] {
  const ruleIdPath = String(item.meta?.ruleIdPath || '').trim()
  const ruleId = Number(ruleIdPath ? ruleIdFromPath : item.meta?.ruleId || 0)
  if (!ruleId) {
    return []
  }

  return [
    {
      ruleId,
      kind: resourceKind,
      bizKey: resolveUploadBizKey(item),
      bizName: String(item.meta?.bizName || '').trim() || undefined,
      categoryId: item.meta?.categoryId,
    },
  ]
}

export function resolveUploadMaxCount(item: UploadItemSchema, uploadType: string) {
  const configured = Number(item.meta?.maxCount || 0)
  if (configured > 0) {
    return configured
  }

  switch (String(uploadType || '').trim()) {
    case 'list':
      return 10
    case 'pic':
    case 'video':
    case 'audio':
    case 'input':
    default:
      return 1
  }
}

export function resolveUploadEmptyText(uploadType: string) {
  switch (String(uploadType || '').trim()) {
    case 'pic':
      return '暂无图片资源。'
    case 'video':
      return '暂无视频资源。'
    case 'audio':
      return '暂无音频资源。'
    default:
      return '暂无文件资源。'
  }
}

export function resolveUploadTypeIcon(uploadType: string, previewKind: string) {
  if (previewKind === 'image') {
    return <FileImage className="size-8" />
  }
  if (previewKind === 'video' || uploadType === 'video') {
    return <Video className="size-8" />
  }
  if (previewKind === 'audio' || uploadType === 'audio') {
    return <Music4 className="size-8" />
  }
  return <FileImage className="size-8" />
}

function resolveUploadBizKey(item: UploadItemSchema) {
  const explicitBizKey = String(item.meta?.bizKey || '').trim()
  if (explicitBizKey) {
    return explicitBizKey
  }

  const valuePath = String(item.value || '').trim()
  if (!valuePath) {
    return undefined
  }

  const normalized = valuePath
    .replace(/^data\./, '')
    .replace(/^state\./, '')
    .replace(/^form\./, '')
    .replace(/_ids?$/, '')

  return normalized || undefined
}
