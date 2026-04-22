export const PAGE_PROGRESS_EVENT = 'front:page-progress'

export type PageProgressDetail = {
  type: 'start' | 'finish'
  key: string
}

export function startPageProgress(key: string) {
  emitPageProgress('start', key)
}

export function finishPageProgress(key: string) {
  emitPageProgress('finish', key)
}

function emitPageProgress(type: PageProgressDetail['type'], key: string) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) {
    return
  }

  window.dispatchEvent(
    new CustomEvent<PageProgressDetail>(PAGE_PROGRESS_EVENT, {
      detail: { type, key: normalizedKey },
    })
  )
}
