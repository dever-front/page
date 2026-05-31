import { getRuntimeConfig } from '@/config/app-config'

const DEFAULT_SYSTEM_PAGE_OWNER = 'front'
const DEFAULT_SITE_KEY = 'admin'

export function systemPageRoute(name: string) {
  const pageName = String(name || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
  const owner = runtimeApiOwner()
  return pageName ? `${owner}/${pageName}` : owner
}

function runtimeApiOwner() {
  const runtime = getRuntimeConfig()
  const apiPrefix = String(runtime.apiPrefix || '').trim()
  if (apiPrefix) {
    return apiPrefix
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
