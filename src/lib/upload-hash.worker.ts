import {
  digestUploadBlobInChunks,
  type UploadHashWorkerRequest,
  type UploadHashWorkerResponse,
} from './upload-hash-core'

type UploadHashWorkerScope = {
  onmessage: ((event: MessageEvent<UploadHashWorkerRequest>) => void) | null
  postMessage: (response: UploadHashWorkerResponse) => void
}

const workerScope = globalThis as unknown as UploadHashWorkerScope

workerScope.onmessage = async (event) => {
  const response: UploadHashWorkerResponse = {}
  try {
    response.hash = await digestUploadBlobInChunks(event.data.file)
  } catch {
    response.error = '计算文件摘要失败'
  }
  workerScope.postMessage(response)
}
