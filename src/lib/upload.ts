import {
  joinFrontApi,
  request,
  requestBlob,
  type RequestOptions,
} from './request'
import { runRuntimeStream } from './runtime-stream-runner'
import { streamValueText, type RuntimeStreamFrame } from './stream'
import { uploadFileDirect, type UploadDirectPayload } from './upload-direct'
import { digestUploadFile } from './upload-hash'

export { digestUploadFile } from './upload-hash'
export { uploadFileDirect } from './upload-direct'
export type { UploadDirectPayload } from './upload-direct'

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
  transport?: string
  reportError?: boolean
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

type UploadSessionInitPayload = {
  session_id: number
  token: string
  transport: string
  chunk_size: number
  chunk_total: number
  mime: string
  direct?: UploadDirectPayload
}

type UploadInitPayload = Partial<UploadSessionInitPayload> & {
  reused?: UploadFileItem
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
  let hash = shouldDigestBeforeInit(options) ? await digestUploadFile(file) : ''
  let initPayload = buildUploadInitPayload(ruleId, file, hash, options)
  let initResult = await request(
    joinFrontApi('upload/init'),
    'post',
    initPayload,
    uploadRequestOptions(options)
  )
  if (shouldRetryInitWithHash(initResult, hash)) {
    hash = await digestUploadFile(file)
    initPayload = buildUploadInitPayload(ruleId, file, hash, options)
    initResult = await request(
      joinFrontApi('upload/init'),
      'post',
      initPayload,
      uploadRequestOptions(options)
    )
  }
  if (initResult.code !== 0 || !initResult.data) {
    throw new Error(initResult.message || '初始化上传失败')
  }

  const payload = initResult.data as UploadInitPayload
  if (payload.reused) {
    options?.onProgress?.(file.size, file.size)
    return payload.reused
  }

  const sessionPayload = normalizeUploadSessionInitPayload(payload)
  if (sessionPayload.transport === 'direct') {
    if (!sessionPayload.direct) {
      throw new Error('初始化上传结果缺少直传配置')
    }
    await uploadFileDirect(
      file,
      sessionPayload.direct,
      options?.onProgress,
      sessionPayload.mime
    )
  } else {
    await uploadFileByRelay(file, sessionPayload, options)
  }

  const completeResult = await request(
    joinFrontApi('upload/complete'),
    'post',
    {
      session_id: sessionPayload.session_id,
      token: sessionPayload.token,
    },
    uploadRequestOptions(options)
  )
  if (completeResult.code !== 0 || !completeResult.data) {
    throw new Error(completeResult.message || '完成上传失败')
  }

  return completeResult.data as UploadFileItem
}

function normalizeUploadSessionInitPayload(
  payload: UploadInitPayload
): UploadSessionInitPayload {
  const sessionId = Number(payload.session_id || 0)
  const token = String(payload.token || '').trim()
  const transport = String(payload.transport || '')
    .trim()
    .toLowerCase()
  const chunkSize = Number(payload.chunk_size || 0)
  const chunkTotal = Number(payload.chunk_total || 0)
  if (!Number.isFinite(sessionId) || sessionId <= 0 || !token) {
    throw new Error('初始化上传结果缺少会话信息')
  }
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
    throw new Error('初始化上传结果缺少分片大小')
  }
  if (!Number.isFinite(chunkTotal) || chunkTotal <= 0) {
    throw new Error('初始化上传结果缺少分片数量')
  }
  return {
    session_id: sessionId,
    token,
    transport,
    chunk_size: chunkSize,
    chunk_total: chunkTotal,
    mime: String(payload.mime || '').trim(),
    direct: payload.direct,
  }
}

export async function importRemoteFileByRule(
  ruleId: number,
  url: string,
  options?: ImportRemoteFileOptions
) {
  options?.onProgress?.(0, 0)
  const result = await request(
    joinFrontApi('upload/import_url'),
    'post',
    buildImportRemotePayload(ruleId, url, options),
    uploadRequestOptions(options)
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
    requestApi: joinFrontApi('upload/import_url_stream'),
    streamApi: joinFrontApi('upload/stream'),
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

function shouldDigestBeforeInit(options?: UploadRequestOptions) {
  return normalizeUploadTransport(options?.transport) === 'direct'
}

function shouldRetryInitWithHash(
  result: { code?: number; message?: string },
  currentHash: string
) {
  if (currentHash || Number(result?.code ?? 0) === 0) {
    return false
  }

  return /hash|哈希|文件标识/i.test(String(result?.message || ''))
}

function normalizeUploadTransport(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
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
    const result = await request(joinFrontApi('upload/rule'), 'get', {
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
  const blob = await requestBlob(
    item.download || item.open_url || item.url || ''
  )
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
  payload: UploadSessionInitPayload,
  options?: UploadRequestOptions
) {
  const chunkSize = Math.max(Number(payload.chunk_size || file.size || 1), 1)
  let loaded = 0

  for (let index = 0; index < payload.chunk_total; index += 1) {
    const start = index * chunkSize
    const end = Math.min(file.size, start + chunkSize)
    const chunk = file.slice(start, end)
    const formData = new FormData()
    formData.append('token', payload.token)
    formData.append('file', chunk, file.name)

    const result = await request(
      joinFrontApi(
        `upload/part?session_id=${payload.session_id}&part_number=${index + 1}`
      ),
      'post',
      formData,
      uploadRequestOptions(options)
    )
    if (result.code !== 0) {
      throw new Error(result.message || '上传分片失败')
    }

    loaded = end
    options?.onProgress?.(loaded, file.size)
  }
}

function uploadRequestOptions(
  options?: Pick<UploadRequestOptions, 'reportError'>
): RequestOptions | undefined {
  return options?.reportError === false ? { reportError: false } : undefined
}

function applyImportStreamStatus(
  frame: RuntimeStreamFrame,
  onStatus?: ImportRemoteFileStreamOptions['onStatus']
) {
  if (!onStatus || !frame?.output) {
    return
  }
  const output = frame.output as Record<string, unknown>
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
  const output = frame.output as Record<string, unknown> | undefined
  const resource = output?.resource
  return resource && typeof resource === 'object'
    ? (resource as UploadFileItem)
    : null
}
