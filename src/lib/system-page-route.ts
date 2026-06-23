import { getRuntimeConfig } from '@/config/app-config'

const DEFAULT_SYSTEM_PAGE_OWNER = 'front'
const DEFAULT_SITE_KEY = 'admin'

export function systemPageRoute(name: string) {
  return runtimePageRoute(name)
}

export function runtimePageRoute(name: string) {
  const pageName = String(name || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
  const owner = runtimeApiOwner()
  if (!pageName) {
    return owner
  }
  if (isRouteUnderPrefix(pageName, owner)) {
    return pageName
  }
  return `${owner}/${pageName}`
}

function isRouteUnderPrefix(route: string, prefix: string) {
  if (!route || !prefix) {
    return false
  }
  return route === prefix || route.startsWith(`${prefix}/`)
}

function runtimeApiOwner() {
  const runtime = getRuntimeConfig()
  const pagePrefix = String(runtime.pagePrefix || '').trim()
  if (pagePrefix) {
    return pagePrefix
  }

  const apiPrefix = String(runtime.apiPrefix || '').trim()
  if (apiPrefix) {
    return firstPathSegment(apiPrefix)
  }

  const host = String(runtime.host || '').trim()
  const owner = firstPathSegment(host)
  if (owner) {
    return owner
  }

  const siteKey = String(runtime.siteKey || '').trim()
  if (siteKey === DEFAULT_SITE_KEY) {
    return DEFAULT_SYSTEM_PAGE_OWNER
  }

  return siteKey || DEFAULT_SYSTEM_PAGE_OWNER
}

function firstPathSegment(value: string) {
  if (!value) {
    return ''
  }

  try {
    const base =
      typeof window === 'undefined'
        ? 'http://localhost'
        : window.location.origin
    const pathname = new URL(value, base).pathname
    return pathname.split('/').find(Boolean) || ''
  } catch {
    return value.split(/[?#]/)[0]?.split('/').find(Boolean) || ''
  }
}
