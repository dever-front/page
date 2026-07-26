import {
  digestUploadBlobInChunks,
  uploadHashBytesToHex,
  type UploadHashWorkerRequest,
  type UploadHashWorkerResponse,
} from './upload-hash-core'

const WEB_CRYPTO_FILE_MAX_BYTES = 16 * 1024 * 1024

export async function digestUploadFile(file: File) {
  if (file.size <= WEB_CRYPTO_FILE_MAX_BYTES) {
    return digestSmallUploadFile(file)
  }

  try {
    return await digestUploadFileInWorker(file)
  } catch {
    return digestUploadFileOnMainThread(file)
  }
}

async function digestSmallUploadFile(file: File) {
  const subtle = globalThis.crypto?.subtle
  if (subtle?.digest) {
    try {
      const digest = await subtle.digest('SHA-256', await file.arrayBuffer())
      return uploadHashBytesToHex(new Uint8Array(digest))
    } catch {
      // Fall through to the bounded incremental implementation.
    }
  }
  return digestUploadFileOnMainThread(file)
}

async function digestUploadFileInWorker(file: File) {
  if (typeof Worker === 'undefined') {
    throw new Error('当前浏览器不支持后台文件校验')
  }

  const worker = new Worker(
    new URL('./upload-hash.worker.ts', import.meta.url),
    {
      type: 'module',
    }
  )
  const request: UploadHashWorkerRequest = { file }
  try {
    return await new Promise<string>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadHashWorkerResponse>) => {
        const hash = String(event.data?.hash || '').trim()
        if (hash) {
          resolve(hash)
          return
        }
        reject(new Error(event.data?.error || '计算文件摘要失败'))
      }
      worker.onerror = () => reject(new Error('后台文件校验失败'))
      worker.postMessage(request)
    })
  } finally {
    worker.terminate()
  }
}

function digestUploadFileOnMainThread(file: File) {
  return digestUploadBlobInChunks(file, yieldToBrowser)
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}
