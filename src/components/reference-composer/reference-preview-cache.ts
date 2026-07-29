import type {
  ReferencePreview,
  ReferencePreviewLoader,
  ReferencePreviewRequest,
} from './types'

const previewRequests = new WeakMap<
  ReferencePreviewLoader,
  Map<string, Promise<ReferencePreview>>
>()

export function loadReferencePreview(
  loader: ReferencePreviewLoader,
  request: ReferencePreviewRequest
) {
  let loaderRequests = previewRequests.get(loader)
  if (!loaderRequests) {
    loaderRequests = new Map()
    previewRequests.set(loader, loaderRequests)
  }

  const key = referencePreviewRequestKey(request)
  const cached = loaderRequests.get(key)
  if (cached) {
    return cached
  }

  const pending = loader(request).catch((error: unknown) => {
    loaderRequests?.delete(key)
    throw error
  })
  loaderRequests.set(key, pending)
  return pending
}

function referencePreviewRequestKey(request: ReferencePreviewRequest) {
  return [
    request.refType,
    request.refId,
    request.versionId || 0,
    request.trigger || '',
  ].join(':')
}
