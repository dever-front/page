import {
  getCurrentRouterHref,
  stripRouterBasePath,
} from '@/lib/router-path'

let activeRouteNavigationKey = ''

export function normalizeRouteKey(route: unknown) {
  const normalized = stripRouterBasePath(route)
  if (!normalized) {
    return ''
  }

  const [withoutHash] = normalized.split('#')
  const [pathname, query = ''] = withoutHash.split('?')
  const normalizedPath = pathname.replace(/^\/+|\/+$/g, '') || '/'
  const normalizedQuery = new URLSearchParams(query).toString()

  return normalizedQuery ? `${normalizedPath}?${normalizedQuery}` : normalizedPath
}

export function buildRouteNavigationKey(route: unknown, state?: unknown) {
  const routeKey = normalizeRouteKey(route)
  if (!routeKey) {
    return ''
  }

  const stateKey = normalizeHistoryStateKey(state)
  return stateKey ? `${routeKey}@${stateKey}` : routeKey
}

export function getCurrentRouteNavigationKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  return buildRouteNavigationKey(getCurrentInternalHref(), window.history.state)
}

export function setActiveRouteNavigationKey(key: string) {
  activeRouteNavigationKey = String(key || '').trim()
}

export function getActiveRouteNavigationKey() {
  return activeRouteNavigationKey || getCurrentRouteNavigationKey()
}

function normalizeHistoryStateKey(state: unknown) {
  if (!state || typeof state !== 'object') {
    return ''
  }

  const historyState = state as {
    __TSR_key?: unknown
    key?: unknown
    __TSR_index?: unknown
  }
  const key = historyState.__TSR_key ?? historyState.key ?? historyState.__TSR_index
  return key == null ? '' : String(key)
}

function getCurrentInternalHref() {
  const hash = window.location.hash || ''
  if (hash.startsWith('#/')) {
    return hash.slice(1)
  }

  return getCurrentRouterHref()
}
