import { getActiveRouteNavigationKey, normalizeRouteKey } from './route-key'

export const PAGE_PROGRESS_EVENT = 'front:page-progress'

export type PageProgressDetail = {
  type: 'start' | 'finish'
  key: string
}

let currentProgressToken = ''
let currentProgressRequestKey = ''
let currentProgressRefCount = 0
let progressSequence = 0
const completedProgressKeys = new Map<string, number>()
const COMPLETED_PROGRESS_KEY_TTL = 15_000

export function startPageProgress(route: string, requestKey?: string) {
  const normalizedRoute = normalizeRouteKey(route)
  if (!normalizedRoute) {
    return ''
  }

  const normalizedRequestKey = String(requestKey || normalizedRoute).trim()
  if (
    !normalizedRequestKey ||
    !isActiveProgressRequestKey(normalizedRequestKey) ||
    hasCompletedProgressKey(normalizedRequestKey)
  ) {
    return ''
  }

  if (currentProgressRequestKey === normalizedRequestKey && currentProgressToken) {
    currentProgressRefCount += 1
    return currentProgressToken
  }

  if (currentProgressRequestKey) {
    rememberCompletedProgressKey(currentProgressRequestKey)
  }

  const progressToken = `${normalizedRequestKey}:${++progressSequence}`
  currentProgressToken = progressToken
  currentProgressRequestKey = normalizedRequestKey
  currentProgressRefCount = 1
  emitPageProgress('start', progressToken)
  return progressToken
}

export function finishPageProgress(progressToken: string) {
  if (!progressToken || progressToken !== currentProgressToken) {
    return
  }

  currentProgressRefCount -= 1
  if (currentProgressRefCount > 0) {
    return
  }

  rememberCompletedProgressKey(currentProgressRequestKey)
  currentProgressToken = ''
  currentProgressRequestKey = ''
  currentProgressRefCount = 0
  emitPageProgress('finish', progressToken)
}

export function resetPageProgressCache() {
  const progressToken = currentProgressToken
  currentProgressToken = ''
  currentProgressRequestKey = ''
  currentProgressRefCount = 0
  completedProgressKeys.clear()
  if (progressToken) {
    emitPageProgress('finish', progressToken)
  }
}

function rememberCompletedProgressKey(requestKey: string) {
  if (!requestKey) {
    return
  }

  pruneCompletedProgressKeys()
  completedProgressKeys.set(requestKey, Date.now())
}

function hasCompletedProgressKey(requestKey: string) {
  pruneCompletedProgressKeys()
  return completedProgressKeys.has(requestKey)
}

function isActiveProgressRequestKey(requestKey: string) {
  const activeKey = getActiveRouteNavigationKey()
  if (!activeKey) {
    return true
  }

  return requestKey === activeKey || requestKey.startsWith(`${activeKey}:reload:`)
}

function pruneCompletedProgressKeys() {
  const now = Date.now()
  for (const [requestKey, completedAt] of completedProgressKeys) {
    if (now - completedAt > COMPLETED_PROGRESS_KEY_TTL) {
      completedProgressKeys.delete(requestKey)
    }
  }
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
