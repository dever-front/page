import { joinFrontApi, request, requestBlob } from './request'
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

export type UploadDirectPayload = {
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

const SHA256_BLOCK_SIZE = 64
const SHA256_HASH_HEX_LENGTH = 32
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

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
  const initResult = await request(
    joinFrontApi('upload/init'),
    'post',
    initPayload
  )
  if (initResult.code !== 0 || !initResult.data) {
    throw new Error(initResult.message || '初始化上传失败')
  }

  const payload = initResult.data as UploadInitPayload
  if (payload.transport === 'direct' && payload.direct) {
    await uploadFileDirect(file, payload.direct, options?.onProgress)
  } else {
    await uploadFileByRelay(file, payload, options?.onProgress)
  }

  const completeResult = await request(joinFrontApi('upload/complete'), 'post', {
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
    joinFrontApi('upload/import_url'),
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
      joinFrontApi(
        `upload/part?session_id=${payload.session_id}&part_number=${index + 1}`
      ),
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

export async function uploadFileDirect(
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

export async function digestUploadFile(file: File) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle?.digest) {
    return digestUploadFileFallback(file)
  }

  try {
    const digest = await subtle.digest('SHA-256', await file.arrayBuffer())
    return hexDigest(new Uint8Array(digest))
  } catch {
    return digestUploadFileFallback(file)
  }
}

function hexDigest(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, SHA256_HASH_HEX_LENGTH)
}

async function digestUploadFileFallback(file: File) {
  try {
    return hexDigest(sha256Bytes(new Uint8Array(await file.arrayBuffer())))
  } catch {
    return ''
  }
}

function sha256Bytes(bytes: Uint8Array) {
  const words = new Uint32Array(64)
  const hash = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ])
  const padded = padSha256Input(bytes)

  for (let offset = 0; offset < padded.length; offset += SHA256_BLOCK_SIZE) {
    for (let index = 0; index < 16; index += 1) {
      const current = offset + index * 4
      words[index] =
        ((padded[current] || 0) << 24) |
        ((padded[current + 1] || 0) << 16) |
        ((padded[current + 2] || 0) << 8) |
        (padded[current + 3] || 0)
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3)
      const s1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10)
      words[index] = add32(words[index - 16], s0, words[index - 7], s1)
    }

    let a = hash[0]
    let b = hash[1]
    let c = hash[2]
    let d = hash[3]
    let e = hash[4]
    let f = hash[5]
    let g = hash[6]
    let h = hash[7]

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = add32(h, s1, ch, SHA256_K[index], words[index])
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = add32(s0, maj)

      h = g
      g = f
      f = e
      e = add32(d, temp1)
      d = c
      c = b
      b = a
      a = add32(temp1, temp2)
    }

    hash[0] = add32(hash[0], a)
    hash[1] = add32(hash[1], b)
    hash[2] = add32(hash[2], c)
    hash[3] = add32(hash[3], d)
    hash[4] = add32(hash[4], e)
    hash[5] = add32(hash[5], f)
    hash[6] = add32(hash[6], g)
    hash[7] = add32(hash[7], h)
  }

  const output = new Uint8Array(32)
  for (let index = 0; index < hash.length; index += 1) {
    const value = hash[index]
    output[index * 4] = value >>> 24
    output[index * 4 + 1] = value >>> 16
    output[index * 4 + 2] = value >>> 8
    output[index * 4 + 3] = value
  }
  return output
}

function padSha256Input(bytes: Uint8Array) {
  const bitLength = bytes.length * 8
  const paddedLength =
    Math.ceil((bytes.length + 1 + 8) / SHA256_BLOCK_SIZE) * SHA256_BLOCK_SIZE
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80

  const high = Math.floor(bitLength / 0x100000000)
  const low = bitLength >>> 0
  const lengthOffset = paddedLength - 8
  padded[lengthOffset] = high >>> 24
  padded[lengthOffset + 1] = high >>> 16
  padded[lengthOffset + 2] = high >>> 8
  padded[lengthOffset + 3] = high
  padded[lengthOffset + 4] = low >>> 24
  padded[lengthOffset + 5] = low >>> 16
  padded[lengthOffset + 6] = low >>> 8
  padded[lengthOffset + 7] = low
  return padded
}

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits))
}

function add32(...values: number[]) {
  return values.reduce((sum, value) => (sum + value) >>> 0, 0)
}
