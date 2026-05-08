import { request, requestBlob, requestRaw } from './request'
import {
  assertRuntimeStreamFrameSuccess,
  readRuntimeStreamFrame,
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
  const result = await request('/front/upload/import_url', 'post', buildImportRemotePayload(ruleId, url, options))
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
  const startFrame = (await requestRaw(
    '/front/upload/import_url_stream',
    'post',
    buildImportRemotePayload(ruleId, url, options)
  )) as RuntimeStreamFrame

  assertRuntimeStreamFrameSuccess(startFrame)
  applyImportStreamStatus(startFrame, options?.onStatus)

  const requestID = streamValueText(startFrame?.request_id)
  if (!requestID) {
    throw new Error('保存资源任务缺少 request_id。')
  }

  let lastID = streamValueText(startFrame?.stream_id) || '0-0'
  const blockMs = Number(options?.blockMs || 1000)
  while (true) {
    const frame = await readRuntimeStreamFrame('/front/upload/stream', requestID, lastID, blockMs)
    assertRuntimeStreamFrameSuccess(frame)
    if (frame.stream_id) {
      lastID = String(frame.stream_id)
    }
    applyImportStreamStatus(frame, options?.onStatus)

    if (frame.type === 'result') {
      const uploaded = normalizeImportStreamResult(frame)
      if (!uploaded) {
        throw new Error(streamValueText(frame.msg) || '保存资源失败')
      }
      return uploaded
    }
  }
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
  if (missingIDs.length > 0) {
    const result = await request('/front/upload/rule', 'get', {
      ids: missingIDs.join(','),
    })
    if (result.code !== 0) {
      throw new Error(result.message || '加载上传规则失败')
    }

    const rows = Array.isArray(result.data) ? result.data : []
    for (const row of rows) {
      const id = Number(row?.id || 0)
      if (!Number.isFinite(id) || id <= 0) {
        continue
      }
      uploadRuleMetaCache.set(id, {
        id,
        name: String(row?.name || '').trim() || undefined,
        accept: String(row?.accept || '').trim() || undefined,
        transport: String(row?.transport || '').trim() || undefined,
      })
    }
  }

  const result = new Map<number, UploadRuleMeta>()
  for (const id of ids) {
    const item = uploadRuleMetaCache.get(id)
    if (item) {
      result.set(id, item)
    }
  }
  return result
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
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}
