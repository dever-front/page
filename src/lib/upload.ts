import { request, requestBlob } from './request'

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

export type UploadRuleMeta = {
  id: number
  name?: string
  accept?: string
  transport?: string
}

type UploadDirectPayload = {
  uploadURL: string
  method?: string
  fields?: Record<string, string>
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
  const formData = new FormData()
  Object.entries(direct.fields || {}).forEach(([key, value]) => {
    formData.append(key, value)
  })
  formData.append('file', file, file.name)

  const response = await fetch(direct.uploadURL, {
    method: String(direct.method || 'post').toUpperCase(),
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`直传失败(${response.status})`)
  }
  onProgress?.(file.size, file.size)
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
