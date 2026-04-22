import { parseRouterSearch } from '@/lib/router-search'

export const NAV_QUERY_KEY = '_nav'

const NAV_STORE_KEY = 'dever:navigation:v1'
const MAX_NAV_RECORDS = 100

type NavigationRecord = {
  from: string
  createdAt: number
}

type NavigationRecords = Record<string, NavigationRecord>

export type NavigationTarget = {
  to: string
  search?: Record<string, unknown>
}

export function withBackNavigationSearch(
  search?: Record<string, unknown>,
  enabled?: unknown
) {
  if (!isBackNavigationEnabled(enabled)) {
    return search
  }

  const token = createNavigationRecord()
  if (!token) {
    return search
  }

  return {
    ...(search ?? {}),
    [NAV_QUERY_KEY]: token,
  }
}

export function getNavigationBackTarget(navValue?: unknown): NavigationTarget | null {
  const token = normalizeNavigationToken(navValue ?? getCurrentNavigationToken())
  if (!token) {
    return null
  }

  const record = readNavigationRecords()[token]
  if (!record || !isSafeInternalHref(record.from)) {
    return null
  }

  return parseInternalNavigationHref(record.from)
}

export function resolveNavigationRouteState(routePath?: string) {
  const href = normalizeRouteHref(routePath) || getCurrentInternalHref()
  const query = parseRouteQuery(href)
  const nav = normalizeNavigationToken(query[NAV_QUERY_KEY])
  const backTarget = getNavigationBackTarget(nav)

  return {
    path: stripRouteQuery(href),
    query,
    nav,
    from: backTarget ? formatNavigationTarget(backTarget) : '',
  }
}

export function parseInternalNavigationHref(href?: unknown): NavigationTarget | null {
  const text = String(href ?? '').trim()
  if (!isSafeInternalHref(text)) {
    return null
  }

  try {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const url = new URL(text, base)
    if (url.origin !== base) {
      return null
    }

    return {
      to: url.pathname || '/',
      search: parseRouterSearch(url.search),
    }
  } catch {
    return null
  }
}

function createNavigationRecord() {
  const from = getCurrentInternalHref()
  if (!isSafeInternalHref(from)) {
    return ''
  }

  const token = createNavigationToken()
  const records = pruneNavigationRecords({
    ...readNavigationRecords(),
    [token]: {
      from,
      createdAt: Date.now(),
    },
  })

  writeNavigationRecords(records)
  return token
}

function getCurrentNavigationToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return parseRouterSearch(window.location.search)[NAV_QUERY_KEY]
}

function getCurrentInternalHref() {
  if (typeof window === 'undefined') {
    return ''
  }

  return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`
}

function normalizeRouteHref(routePath?: string) {
  return String(routePath || '').trim()
}

function stripRouteQuery(href: string) {
  return href.replace(/[?#].*$/, '') || '/'
}

function parseRouteQuery(href: string) {
  const queryIndex = href.indexOf('?')
  if (queryIndex < 0) {
    return {}
  }

  const hashIndex = href.indexOf('#', queryIndex)
  const query = hashIndex >= 0 ? href.slice(queryIndex, hashIndex) : href.slice(queryIndex)
  return parseRouterSearch(query)
}

function normalizeNavigationToken(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }
  return String(value ?? '').trim()
}

function isBackNavigationEnabled(value: unknown) {
  return value === true || String(value ?? '').trim() === 'true'
}

function isSafeInternalHref(href: string) {
  const text = String(href || '').trim()
  if (!text || !text.startsWith('/') || text.startsWith('//')) {
    return false
  }
  return !/^[a-z][a-z0-9+.-]*:/i.test(text)
}

function formatNavigationTarget(target: NavigationTarget) {
  const search = target.search ?? {}
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    appendNavigationSearchParam(query, key, value)
  }

  const queryString = query.toString()
  return `${target.to}${queryString ? `?${queryString}` : ''}`
}

function appendNavigationSearchParam(
  query: URLSearchParams,
  key: string,
  value: unknown
) {
  if (!key || value == null || value === '') {
    return
  }

  if (Array.isArray(value) || typeof value === 'object') {
    query.set(key, JSON.stringify(value))
    return
  }

  query.set(key, String(value))
}

function createNavigationToken() {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replaceAll('-', '')
      : Math.random().toString(36).slice(2)

  return `n_${Date.now().toString(36)}_${random}`
}

function readNavigationRecords(): NavigationRecords {
  if (typeof sessionStorage === 'undefined') {
    return {}
  }

  try {
    const raw = sessionStorage.getItem(NAV_STORE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeNavigationRecords(records: NavigationRecords) {
  if (typeof sessionStorage === 'undefined') {
    return
  }

  try {
    sessionStorage.setItem(NAV_STORE_KEY, JSON.stringify(records))
  } catch {
    // sessionStorage 不可用时只是不支持返回链，不影响正常跳转。
  }
}

function pruneNavigationRecords(records: NavigationRecords) {
  const entries = Object.entries(records).sort(
    (a, b) => Number(b[1]?.createdAt ?? 0) - Number(a[1]?.createdAt ?? 0)
  )

  return Object.fromEntries(entries.slice(0, MAX_NAV_RECORDS))
}
