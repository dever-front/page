import { getRuntimeConfig } from '@/config/app-config'

export function getRouterBasePath() {
  const basePath = String(getRuntimeConfig()?.basePath || '').trim()
  if (!basePath || basePath === '/') {
    return ''
  }
  return `/${basePath.replace(/^\/+|\/+$/g, '')}`
}

export function stripRouterBasePath(path: unknown) {
  const text = String(path ?? '').trim()
  if (!text) {
    return ''
  }

  const { pathname, suffix } = splitPathSuffix(text)
  const normalizedPath = normalizePathname(pathname)
  const basePath = getRouterBasePath()
  if (!basePath) {
    return `${normalizedPath}${suffix}`
  }

  let routePath = normalizedPath
  while (routePath === basePath || routePath.startsWith(`${basePath}/`)) {
    if (routePath === basePath) {
      return `/${suffix}`
    }
    routePath = routePath.slice(basePath.length) || '/'
  }

  return `${routePath}${suffix}`
}

export function getCurrentRouterPathname() {
  if (typeof window === 'undefined') {
    return '/'
  }
  return stripRouterBasePath(window.location.pathname || '/') || '/'
}

export function getCurrentRouterHref() {
  if (typeof window === 'undefined') {
    return ''
  }
  return `${getCurrentRouterPathname()}${window.location.search || ''}${window.location.hash || ''}`
}

function splitPathSuffix(value: string) {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const suffixIndex =
    queryIndex < 0
      ? hashIndex
      : hashIndex < 0
        ? queryIndex
        : Math.min(queryIndex, hashIndex)

  if (suffixIndex < 0) {
    return { pathname: value, suffix: '' }
  }
  return {
    pathname: value.slice(0, suffixIndex),
    suffix: value.slice(suffixIndex),
  }
}

function normalizePathname(pathname: string) {
  const normalized = String(pathname || '').trim().replace(/\/+$/, '')
  if (!normalized) {
    return '/'
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}
