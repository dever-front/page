export function clipboardImageFiles(data: DataTransfer | null) {
  if (!data) {
    return []
  }

  const files = Array.from(data.files || []).filter(isImageFile)
  if (files.length > 0) {
    return files
  }

  return Array.from(data.items || [])
    .filter(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    )
    .map((item) => item.getAsFile())
    .filter((file): file is File => file != null && isImageFile(file))
}

export function clipboardRemoteImageUrl(data: DataTransfer | null) {
  if (!data) {
    return ''
  }

  const plainTextUrl = httpUrl(data.getData('text/plain'))
  if (plainTextUrl) {
    return plainTextUrl
  }

  const html = data.getData('text/html').trim()
  if (!html || typeof DOMParser === 'undefined') {
    return ''
  }

  const document = new DOMParser().parseFromString(html, 'text/html')
  const images = Array.from(document.body.querySelectorAll('img[src]'))
  if (images.length !== 1 || document.body.textContent?.trim()) {
    return ''
  }
  return httpUrl(images[0].getAttribute('src'))
}

function isImageFile(file: File) {
  return String(file.type || '')
    .toLowerCase()
    .startsWith('image/')
}

function httpUrl(value: string | null) {
  const url = String(value || '').trim()
  if (!url || /\s/.test(url)) {
    return ''
  }
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? url
      : ''
  } catch {
    return ''
  }
}
