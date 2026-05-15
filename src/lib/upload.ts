import { request, requestBlob } from './request'
import { runRuntimeStream } from './runtime-stream-runner'
import {
  streamValueText,
  type RuntimeStreamFrame,
} from './stream'

export type UploadFileItem = {
  id: string | number
  rule_id?: string | number
  kind?: string
  biz_id?: string | number
  biz_key?: string
  biz_name?: string
  category_id?: string | number
  name: string
  ext?: string
  mime?: string
  size?: number
  hash?: string
  path?: string
  url?: string
  open_url?: string
  download?: string
  thumbnail?: string
  created_at?: string
}

export type UploadRequestOptions = {
  kind?: string
  bizKey?: string
  bizName?: string
  categoryId?: string | number
  onProgress?: (loaded: number, total: number) => void
}

export type ImportRemoteFileOptions = UploadRequestOptions & {
  name?: string
  mime?: string
}

export type ImportRemoteFileStreamOptions = ImportRemoteFileOptions & {
  blockMs?: number
  onStatus?: (status: { message: string; progress?: number | null }) => void
}

export type UploadRuleMeta = {
  id: number
  name?: string
  accept?: string
  transport?: string
}

type UploadDirectPayload = {
  uploadURL?: string
  upload_url?: string
  UploadURL?: string
  method?: string
  Method?: string
  fields?: Record<string, string>
  Fields?: Record<string, string>
}

type UploadInitPayload = {
  session_id: number
  transport: string
  chunk_size: number
  chunk_total: number
  direct?: UploadDirectPayload
}

const uploadRuleMetaCache = new Map<number, UploadRuleMeta>()
const uploadRuleMetaPending = new Map<number, Promise<void>>()
const uploadRuleMetaBatchIDs = new Set<number>()
let uploadRuleMetaBatchPromise: Promise<void> | null = null

export async function uploadFileByRule(
  ruleId: number,
  file: File,
  options?: UploadRequestOptions
) {
  const hash = await digestUploadFile(file)
  const initPayload = buildUploadInitPayload(ruleId, file, hash, options)
  const initResult = await request('/front/upload/init', 'post', initPayload)
  if (initResult.code !== 0 || !initResult.data) {
    throw new Error(initResult.message || '初始化上传失败')
  }

  const payload = initResult.data as UploadInitPayload
  if (payload.transport === 'direct' && payload.direct) {
    await uploadFileDirect(file, payload.direct, options?.onProgress)
  } else {
    await uploadFileByRelay(file, payload, options?.onProgress)
  }

  const completeResult = await request('/front/upload/complete', 'post', {
    session_id: payload.session_id,
  })
  if (completeResult.code !== 0 || !completeResult.data) {
    throw new Error(completeResult.message || '完成上传失败')
  }

  return completeResult.data as UploadFileItem
}

export async function importRemoteFileByRule(
  ruleId: number,
  url: string,
  options?: ImportRemoteFileOptions
) {
  options?.onProgress?.(0, 0)
  const result = await request(
    '/front/upload/import_url',
    'post',
    buildImportRemotePayload(ruleId, url, options)
  )
  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '保存资源失败')
  }
  options?.onProgress?.(100, 100)
  return result.data as UploadFileItem
}

export async function importRemoteFileByRuleStream(
  ruleId: number,
  url: string,
  options?: ImportRemoteFileStreamOptions
) {
  let resultFrame: RuntimeStreamFrame | null = null
  await runRuntimeStream({
    requestApi: '/front/upload/import_url_stream',
    streamApi: '/front/upload/stream',
    body: buildImportRemotePayload(ruleId, url, options),
    blockMs: Number(options?.blockMs || 1000),
    useStartFrameStreamID: true,
    missingRequestIDMessage: '保存资源任务缺少 request_id。',
    onFrame: (frame) => {
      applyImportStreamStatus(frame, options?.onStatus)
      if (frame.type === 'result') {
        resultFrame = frame
      }
    },
  })

  const uploaded = resultFrame ? normalizeImportStreamResult(resultFrame) : null
  if (!uploaded) {
    throw new Error(streamValueText(resultFrame?.msg) || '保存资源失败')
  }
  return uploaded
}

function buildUploadInitPayload(
  ruleId: number,
  file: File,
  hash: string,
  options?: UploadRequestOptions
) {
  const payload: Record<string, unknown> = {
    rule_id: ruleId,
    name: file.name,
    size: file.size,
    mime: file.type,
    hash,
  }

  const kind = String(options?.kind || '').trim()
  if (kind) {
    payload.kind = kind
  }

  const bizKey = String(options?.bizKey || '').trim()
  if (bizKey) {
    payload.biz_key = bizKey
  }

  const bizName = String(options?.bizName || '').trim()
  if (bizName) {
    payload.biz_name = bizName
  }

  const categoryId = Number(options?.categoryId || 0)
  if (Number.isFinite(categoryId) && categoryId > 0) {
    payload.category_id = categoryId
  }

  return payload
}

function buildImportRemotePayload(
  ruleId: number,
  url: string,
  options?: ImportRemoteFileOptions
) {
  return {
    rule_id: ruleId,
    url,
    name: String(options?.name || '').trim(),
    mime: String(options?.mime || '').trim(),
    kind: String(options?.kind || '').trim(),
    biz_key: String(options?.bizKey || '').trim(),
    biz_name: String(options?.bizName || '').trim(),
    category_id: Number(options?.categoryId || 0),
  }
}

export async function listUploadRuleMetas(ruleIds: number[]) {
  const ids = Array.from(
    new Set(
      (Array.isArray(ruleIds) ? ruleIds : [])
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    )
  )

  const missingIDs = ids.filter((id) => !uploadRuleMetaCache.has(id))
  const pendingRequests = missingIDs
    .map((id) => uploadRuleMetaPending.get(id))
    .filter((item): item is Promise<void> => !!item)
  const requestIDs = missingIDs.filter((id) => !uploadRuleMetaPending.has(id))

  if (requestIDs.length > 0) {
    const requestPromise = queueUploadRuleMetaFetch(requestIDs)
    requestIDs.forEach((id) => uploadRuleMetaPending.set(id, requestPromise))
    pendingRequests.push(requestPromise)
  }

  if (pendingRequests.length > 0) {
    await Promise.all(pendingRequests)
  }

  return getCachedUploadRuleMetas(ids)
}

export function getCachedUploadRuleMetas(ruleIds: number[]) {
  const result = new Map<number, UploadRuleMeta>()
  for (const id of ruleIds) {
    const item = uploadRuleMetaCache.get(id)
    if (item) {
      result.set(id, item)
    }
  }
  return result
}

async function fetchUploadRuleMetas(ruleIds: number[]) {
  try {
    const result = await request('/front/upload/rule', 'get', {
      ids: ruleIds.join(','),
    })
    if (result.code !== 0) {
      throw new Error(result.message || '加载上传规则失败')
    }

    const loadedIDs = new Set<number>()
    const rows = Array.isArray(result.data) ? result.data : []
    for (const row of rows) {
      const id = Number(row?.id || 0)
      if (!Number.isFinite(id) || id <= 0) {
        continue
      }
      loadedIDs.add(id)
      uploadRuleMetaCache.set(id, {
        id,
        name: String(row?.name || '').trim() || undefined,
        accept: String(row?.accept || '').trim() || undefined,
        transport: String(row?.transport || '').trim() || undefined,
      })
    }

    for (const id of ruleIds) {
      if (!loadedIDs.has(id)) {
        uploadRuleMetaCache.set(id, { id })
      }
    }
  } finally {
    ruleIds.forEach((id) => uploadRuleMetaPending.delete(id))
  }
}

function queueUploadRuleMetaFetch(ruleIds: number[]) {
  ruleIds.forEach((id) => uploadRuleMetaBatchIDs.add(id))
  if (!uploadRuleMetaBatchPromise) {
    uploadRuleMetaBatchPromise = Promise.resolve().then(async () => {
      const ids = Array.from(uploadRuleMetaBatchIDs)
      uploadRuleMetaBatchIDs.clear()
      uploadRuleMetaBatchPromise = null
      await fetchUploadRuleMetas(ids)
    })
  }
  return uploadRuleMetaBatchPromise
}

export async function downloadUploadFile(item: UploadFileItem) {
  const blob = await requestBlob(item.download || item.open_url || item.url || '')
  if (!blob) {
    throw new Error('下载文件失败')
  }

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = item.name || 'file'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

async function uploadFileByRelay(
  file: File,
  payload: UploadInitPayload,
  onProgress?: (loaded: number, total: number) => void
) {
  const chunkSize = Math.max(Number(payload.chunk_size || file.size || 1), 1)
  let loaded = 0

  for (let index = 0; index < payload.chunk_total; index += 1) {
    const start = index * chunkSize
    const end = Math.min(file.size, start + chunkSize)
    const chunk = file.slice(start, end)
    const formData = new FormData()
    formData.append('file', chunk, file.name)

    const result = await request(
      `/front/upload/part?session_id=${payload.session_id}&part_number=${index + 1}`,
      'post',
      formData
    )
    if (result.code !== 0) {
      throw new Error(result.message || '上传分片失败')
    }

    loaded = end
    onProgress?.(loaded, file.size)
  }
}

async function uploadFileDirect(
  file: File,
  direct: UploadDirectPayload,
  onProgress?: (loaded: number, total: number) => void
) {
  const uploadURL = String(direct.uploadURL || direct.upload_url || direct.UploadURL || '').trim()
  if (!uploadURL) {
    throw new Error('直传地址为空')
  }

  const formData = new FormData()
  Object.entries(direct.fields || direct.Fields || {}).forEach(([key, value]) => {
    formData.append(key, value)
  })
  formData.append('file', file, file.name)

  const response = await fetch(uploadURL, {
    method: String(direct.method || direct.Method || 'post').toUpperCase(),
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`直传失败(${response.status})`)
  }
  onProgress?.(file.size, file.size)
}

function applyImportStreamStatus(
  frame: RuntimeStreamFrame,
  onStatus?: ImportRemoteFileStreamOptions['onStatus']
) {
  if (!onStatus || !frame?.output) {
    return
  }
  const output = frame.output as Record<string, any>
  const message = streamValueText(output.text)
  const rawProgress = Number(output.progress)
  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, Math.round(rawProgress)))
    : null
  if (!message && progress == null) {
    return
  }
  onStatus({
    message,
    progress,
  })
}

function normalizeImportStreamResult(frame: RuntimeStreamFrame) {
  const output = frame.output as Record<string, any> | undefined
  const resource = output?.resource
  return resource && typeof resource === 'object' ? (resource as UploadFileItem) : null
}

async function digestUploadFile(file: File) {
  const buffer = await file.arrayBuffer()
  const subtle = globalThis.crypto?.subtle
  if (subtle?.digest) {
    try {
      const digest = await subtle.digest('SHA-256', buffer)
      return hexDigest(new Uint8Array(digest))
    } catch {
      // Fall back below for non-standard or restricted browser contexts.
    }
  }
  return fallbackUploadDigest(file, new Uint8Array(buffer))
}

function hexDigest(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

function fallbackUploadDigest(file: File, bytes: Uint8Array) {
  const seed = new TextEncoder().encode(
    `${file.name}\u0000${file.type}\u0000${file.size}\u0000${file.lastModified}`
  )
  const hashes = [
    0x811c9dc5,
    0x811c9dc5 ^ 0x9e3779b9,
    0x811c9dc5 ^ 0x85ebca6b,
    0x811c9dc5 ^ 0xc2b2ae35,
  ]
  updateFallbackHashes(hashes, seed)
  updateFallbackHashes(hashes, bytes)
  return hashes
    .map((value) => (value >>> 0).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 32)
}

function updateFallbackHashes(hashes: number[], bytes: Uint8Array) {
  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index]
    hashes[0] = Math.imul(hashes[0] ^ value, 0x01000193)
    hashes[1] = Math.imul(hashes[1] ^ (value + index), 0x01000193)
    hashes[2] = Math.imul(hashes[2] + value + index, 0x85ebca6b)
    hashes[3] = Math.imul(hashes[3] ^ ((value << (index % 8)) >>> 0), 0xc2b2ae35)
  }
}
