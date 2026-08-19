export type UploadDirectPayload = {
  uploadURL?: string
  upload_url?: string
  UploadURL?: string
  method?: string
  Method?: string
  fields?: Record<string, string>
  Fields?: Record<string, string>
}

export async function uploadFileDirect(
  file: File,
  direct: UploadDirectPayload,
  onProgress?: (loaded: number, total: number) => void,
  mimeType?: string
) {
  const uploadURL = String(
    direct.uploadURL || direct.upload_url || direct.UploadURL || ''
  ).trim()
  if (!uploadURL) {
    throw new Error('直传地址为空')
  }

  const formData = new FormData()
  Object.entries(direct.fields || direct.Fields || {}).forEach(
    ([key, value]) => {
      formData.append(key, value)
    }
  )
  const resolvedMimeType = String(mimeType || '').trim()
  const uploadBody = resolvedMimeType
    ? file.slice(0, file.size, resolvedMimeType)
    : file
  formData.append('file', uploadBody, file.name)

  await sendDirectUpload({
    uploadURL,
    method: String(direct.method || direct.Method || 'post').toUpperCase(),
    formData,
    fileSize: file.size,
    onProgress,
  })
}

function sendDirectUpload(input: {
  uploadURL: string
  method: string
  formData: FormData
  fileSize: number
  onProgress?: (loaded: number, total: number) => void
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(input.method, input.uploadURL)
    request.upload.addEventListener('progress', (event) => {
      const total =
        event.lengthComputable && event.total > 0 ? event.total : input.fileSize
      const loaded = Math.max(
        0,
        Math.min(Number(event.loaded || 0), Math.max(total, 0))
      )
      input.onProgress?.(loaded, total)
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        input.onProgress?.(input.fileSize, input.fileSize)
        resolve()
        return
      }
      reject(new Error(`直传失败(${request.status})`))
    })
    request.addEventListener('error', () => {
      reject(new Error('直传失败(网络错误)'))
    })
    request.addEventListener('abort', () => {
      reject(new Error('直传已取消'))
    })
    request.send(input.formData)
  })
}
