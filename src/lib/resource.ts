import { joinFrontApi, request, resolveAssetUrl } from '@/lib/request'
import type { UploadFileItem, UploadRuleMeta } from '@/lib/upload'

export type ResourceScope = 'current' | 'all'
export const UNCATEGORIZED_RESOURCE_CATEGORY = '__uncategorized__'

export type ResourceQuery = {
  page?: number
  pageSize?: number
  bizKey?: string
  kind?: string
  keyword?: string
  fileType?: string
  categoryId?: string
}

export type ResourceListResult = {
  list: UploadFileItem[]
  page: number
  pageSize: number
  total: number
}

export type ResourceCategoryItem = {
  id: string
  value: string
}

export type ResourceSourceItem = {
  id: string
  value: string
}

export type ResourceUploadRule = {
  ruleId: number
  accept?: string
  kind?: string
  bizKey?: string
  bizName?: string
  categoryId?: string | number
}

export function normalizeResourceSourceName(value: unknown) {
  const normalizedValue = String(value || '').trim()
  return normalizedValue === 'Energon生成' ? 'AI生成' : normalizedValue
}

export function normalizeResourceCategoryId(value: unknown) {
  const normalizedValue = String(value || '').trim()
  if (
    !normalizedValue ||
    normalizedValue === 'all' ||
    normalizedValue === UNCATEGORIZED_RESOURCE_CATEGORY
  ) {
    return ''
  }

  return normalizedValue
}

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
])

export async function listResources(
  query: ResourceQuery
): Promise<ResourceListResult> {
  const result = await request(joinFrontApi('resource/list'), 'get', {
    page: query.page ?? 1,
    page_size: query.pageSize ?? 24,
    biz_key: query.bizKey ?? '',
    kind: query.kind ?? '',
    keyword: query.keyword ?? '',
    file_type: query.fileType ?? '',
    category_id: query.categoryId ?? '',
  })

  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '加载资源失败')
  }

  const payload = result.data as Record<string, any>
  return {
    list: normalizeUploadItems(payload.list),
    page: Number(payload.page || query.page || 1),
    pageSize: Number(payload.pageSize || query.pageSize || 24),
    total: Number(payload.total || 0),
  }
}

export async function listResourceCategories(input?: {
  bizKey?: string
  kind?: string
}) {
  const result = await request(joinFrontApi('resource/category'), 'get', {
    biz_key: input?.bizKey ?? '',
    kind: input?.kind ?? '',
  })

  if (result.code !== 0) {
    throw new Error(result.message || '加载资源分类失败')
  }

  if (!Array.isArray(result.data)) {
    return [] as ResourceCategoryItem[]
  }

  return result.data
    .map((item) => ({
      id: String(item?.id || '').trim(),
      value: String(item?.value || item?.id || '').trim(),
    }))
    .filter((item) => item.id && item.value)
}

export async function listResourceSources(input?: { kind?: string }) {
  const result = await request(joinFrontApi('resource/source'), 'get', {
    kind: input?.kind ?? '',
  })

  if (result.code !== 0) {
    throw new Error(result.message || '加载资源来源失败')
  }

  if (!Array.isArray(result.data)) {
    return [] as ResourceSourceItem[]
  }

  return result.data
    .map((item) => ({
      id: String(item?.id || '').trim(),
      value: normalizeResourceSourceName(item?.value || item?.id),
    }))
    .filter((item) => item.id && item.value)
}

export async function assignResourceCategory(
  fileID: string | number,
  categoryId?: string | number
) {
  return assignResourceCategories([fileID], categoryId)
}

export async function assignResourceCategories(
  fileIDs: Array<string | number>,
  categoryId?: string | number
) {
  const normalizedFileIDs = fileIDs
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)

  if (normalizedFileIDs.length === 0) {
    throw new Error('资源文件不能为空')
  }

  const result = await request(
    joinFrontApi('resource/assign_category'),
    'post',
    {
      file_id: normalizedFileIDs[0],
      file_ids: normalizedFileIDs,
      category_id: Number(normalizeResourceCategoryId(categoryId) || 0),
    }
  )

  if (result.code !== 0) {
    throw new Error(result.message || '更新资源分类失败')
  }

  return result.data
}

export function buildFilterCategoryItems(categories: ResourceCategoryItem[]) {
  const items = Array.isArray(categories) ? [...categories] : []
  if (items.some((item) => item.id === UNCATEGORIZED_RESOURCE_CATEGORY)) {
    return items
  }

  return [
    {
      id: UNCATEGORIZED_RESOURCE_CATEGORY,
      value: '未分类',
    },
    ...items,
  ]
}

export function buildFilterSourceItems(
  sources: ResourceSourceItem[],
  fallbackSourceKey?: string,
  fallbackSourceName?: string
) {
  const normalizedFallbackKey = String(fallbackSourceKey || '').trim()
  const normalizedFallbackName = normalizeResourceSourceName(fallbackSourceName)
  const result: ResourceSourceItem[] = []
  const seen = new Set<string>()

  const appendItem = (item?: ResourceSourceItem | null) => {
    const id = String(item?.id || '').trim()
    const value = normalizeResourceSourceName(item?.value)
    if (!id || !value || seen.has(id)) {
      return
    }

    seen.add(id)
    result.push({ id, value })
  }

  if (normalizedFallbackKey) {
    appendItem({
      id: normalizedFallbackKey,
      value: normalizedFallbackName || normalizedFallbackKey,
    })
  }

  for (const current of Array.isArray(sources) ? sources : []) {
    appendItem(current)
  }

  return result
}

export function normalizeUploadItems(value: unknown): UploadFileItem[] {
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

export function normalizeUploadUrlItems(
  value: unknown,
  input?: {
    kind?: string
    uploadType?: string
  }
) {
  const kind = resolveResourceKind({
    kind: input?.kind,
    uploadType: input?.uploadType,
  })
  const items = extractUploadUrlObjects(value)
  return items
    .map((current, index) => buildUploadUrlItem(current.url, kind, index, current.name))
    .filter((current): current is UploadFileItem => !!current)
}

export function resolveUploadSelectionKeys(item?: UploadFileItem | null) {
  if (!item) {
    return [] as string[]
  }

  const keys: string[] = []
  const id = String(item.id ?? '').trim()
  if (id) {
    keys.push(`id:${id}`)
  }

  const url = resolveAssetUrl(String(item.url || item.open_url || item.download || '').trim())
  if (url) {
    keys.push(`url:${url}`)
  }

  return Array.from(new Set(keys))
}

export function isSameUploadSelectionItem(
  left?: UploadFileItem | null,
  right?: UploadFileItem | null
) {
  if (!left || !right) {
    return false
  }

  const rightKeys = new Set(resolveUploadSelectionKeys(right))
  return resolveUploadSelectionKeys(left).some((current) => rightKeys.has(current))
}

export function serializeUploadUrlItems(items: UploadFileItem[]) {
  const records = new Map<string, { name: string; url: string }>()
  for (const item of Array.isArray(items) ? items : []) {
    const url = resolveAssetUrl(
      String(item?.url || item?.open_url || item?.download || '').trim()
    )
    if (!url) {
      continue
    }
    const name =
      String(item?.name || '').trim() || resolveUploadUrlName(url, records.size)
    records.set(url, { name, url })
  }
  return JSON.stringify(Array.from(records.values()))
}

export function normalizeUploadItem(value: any): UploadFileItem {
  const id = value?.id ?? value?.value ?? value?.label ?? ''
  const fallbackOpenUrl =
    id !== '' ? resolveAssetUrl(joinFrontApi(`upload/open?id=${id}`)) : ''

  return {
    id,
    rule_id: value?.rule_id,
    kind: String(value?.kind || '').trim() || undefined,
    biz_id: value?.biz_id,
    biz_key: String(value?.biz_key || '').trim() || undefined,
    biz_name: String(value?.biz_name || '').trim() || undefined,
    category_id: value?.category_id,
    name: String(value?.name || value?.value || value?.label || id || ''),
    ext: String(value?.ext || '').trim() || undefined,
    mime: String(value?.mime || '').trim() || undefined,
    size: Number(value?.size || 0),
    hash: value?.hash,
    path: value?.path,
    url: resolveAssetUrl(String(value?.url || fallbackOpenUrl || '').trim()) || undefined,
    open_url:
      resolveAssetUrl(String(value?.open_url || fallbackOpenUrl || '').trim()) || undefined,
    download:
      resolveAssetUrl(String(value?.download || fallbackOpenUrl || '').trim()) || undefined,
    thumbnail:
      resolveAssetUrl(String(value?.thumbnail || fallbackOpenUrl || '').trim()) || undefined,
    created_at: String(value?.created_at || '').trim() || undefined,
  }
}

export function isImageResource(item?: UploadFileItem | null) {
  if (!item) {
    return false
  }

  if (String(item.kind || '').trim() === 'image') {
    return true
  }

  if (String(item.mime || '').toLowerCase().startsWith('image/')) {
    return true
  }

  return IMAGE_EXTENSIONS.has(String(item.ext || '').toLowerCase())
}

function extractUploadUrlObjects(value: unknown): Array<{ name?: string; url: string }> {
  if (Array.isArray(value)) {
    return value
      .flatMap((current) => extractUploadUrlObjects(current))
      .filter(Boolean)
  }

  if (value && typeof value === 'object') {
    const normalized = normalizeUploadItem(value)
    const url = String(normalized.url || normalized.open_url || normalized.download || '').trim()
    return url
      ? [
          {
            name: String(normalized.name || '').trim() || undefined,
            url,
          },
        ]
      : []
  }

  const current = String(value || '').trim()
  if (!current) {
    return []
  }

  if (
    (current.startsWith('[') && current.endsWith(']')) ||
    (current.startsWith('{') && current.endsWith('}'))
  ) {
    try {
      return extractUploadUrlObjects(JSON.parse(current))
    } catch {
      return [{ url: current }]
    }
  }

  return [{ url: current }]
}

function buildUploadUrlItem(urlValue: string, kind: string, index: number, name?: string) {
  const resolvedUrl = resolveAssetUrl(String(urlValue || '').trim())
  if (!resolvedUrl) {
    return null
  }

  return {
    id: resolvedUrl || `upload-url-${index}`,
    kind: kind || undefined,
    name: String(name || '').trim() || resolveUploadUrlName(resolvedUrl, index),
    url: resolvedUrl,
    open_url: resolvedUrl,
    download: resolvedUrl,
    thumbnail: kind === 'image' ? resolvedUrl : undefined,
  }
}

function resolveUploadUrlName(urlValue: string, index: number) {
  try {
    const parsed = new URL(urlValue)
    const pathName = decodeURIComponent(parsed.pathname || '').trim()
    const parts = pathName.split('/').filter(Boolean)
    if (parts.length > 0) {
      return parts[parts.length - 1]
    }
  } catch {
    // ignore invalid URL and fallback to string parsing
  }

  const normalized = decodeURIComponent(String(urlValue || '').split('?')[0].trim())
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length > 0) {
    return parts[parts.length - 1]
  }
  return `file-${index + 1}`
}

export function isVideoResource(item?: UploadFileItem | null) {
  if (!item) {
    return false
  }

  if (String(item.kind || '').trim() === 'video') {
    return true
  }

  return String(item.mime || '').toLowerCase().startsWith('video/')
}

export function isAudioResource(item?: UploadFileItem | null) {
  if (!item) {
    return false
  }

  if (String(item.kind || '').trim() === 'audio') {
    return true
  }

  return String(item.mime || '').toLowerCase().startsWith('audio/')
}

export function resolveResourcePreviewKind(item?: UploadFileItem | null) {
  if (isImageResource(item)) {
    return 'image'
  }
  if (isVideoResource(item)) {
    return 'video'
  }
  if (isAudioResource(item)) {
    return 'audio'
  }
  return ''
}

export function isPreviewableResource(item?: UploadFileItem | null) {
  return !!resolveResourcePreviewKind(item)
}

export function formatUploadSize(size: number) {
  if (!size || size <= 0) {
    return '-'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let current = size
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }

  const precision = current >= 10 || index === 0 ? 0 : 1
  return `${current.toFixed(precision)} ${units[index]}`
}

export function resolveResourceKind(input?: {
  kind?: unknown
  accept?: unknown
  uploadType?: unknown
}) {
  const explicitKind = String(input?.kind || '').trim().toLowerCase()
  if (['image', 'video', 'audio', 'file', 'other'].includes(explicitKind)) {
    return explicitKind
  }

  const accept = String(input?.accept || '').trim().toLowerCase()
  if (accept.startsWith('image/')) {
    return 'image'
  }
  if (accept.startsWith('video/')) {
    return 'video'
  }
  if (accept.startsWith('audio/')) {
    return 'audio'
  }

  if (String(input?.uploadType || '').trim() === 'pic') {
    return 'image'
  }

  return 'file'
}

export function normalizeResourceUploadRules(value: unknown) {
  const source = resolveResourceUploadRuleSource(value)
  if (!Array.isArray(source)) {
    return [] as ResourceUploadRule[]
  }

  return source
    .map((item) => ({
      ruleId: Number(item?.ruleId || item?.rule_id || 0),
      accept: String(item?.accept || '').trim() || undefined,
      kind: String(item?.kind || '').trim() || undefined,
      bizKey: String(item?.bizKey || item?.biz_key || '').trim() || undefined,
      bizName: normalizeResourceSourceName(item?.bizName || item?.biz_name) || undefined,
      categoryId: item?.categoryId ?? item?.category_id,
    }))
    .filter((item) => item.ruleId > 0)
}

function resolveResourceUploadRuleSource(value: unknown) {
  if (Array.isArray(value)) {
    return value
  }

  const raw = String(value || '').trim()
  if (!raw || (!raw.startsWith('[') && !raw.startsWith('{'))) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function mergeResourceUploadRules(
  rules: ResourceUploadRule[],
  ruleMetas: Map<number, UploadRuleMeta>
) {
  return (Array.isArray(rules) ? rules : []).map((item) => {
    const meta = ruleMetas.get(Number(item.ruleId))
    const accept = String(item.accept || meta?.accept || '').trim() || undefined
    const kind =
      String(item.kind || '').trim() ||
      resolveResourceKind({
        accept,
      })

    return {
      ...item,
      accept,
      kind,
    }
  })
}

export function resolveUploadActionLabel(
  rules: ResourceUploadRule[],
  fallbackKind?: string
) {
  const kinds = Array.from(
    new Set(
      (Array.isArray(rules) ? rules : [])
        .map((item) =>
          resolveResourceKind({
            kind: item.kind,
            accept: item.accept,
          })
        )
        .filter(Boolean)
    )
  )

  const normalizedFallbackKind = resolveResourceKind({ kind: fallbackKind })
  const effectiveKinds = kinds.length > 0 ? kinds : normalizedFallbackKind ? [normalizedFallbackKind] : []

  if (effectiveKinds.length !== 1) {
    return '上传资源'
  }

  switch (effectiveKinds[0]) {
    case 'image':
      return '上传图片'
    case 'video':
      return '上传视频'
    case 'audio':
      return '上传音频'
    case 'file':
      return '上传文件'
    default:
      return '上传资源'
  }
}
