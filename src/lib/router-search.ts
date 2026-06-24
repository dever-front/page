type RouterSearch = Record<string, unknown>

export function parseRouterSearch(searchStr: string): RouterSearch {
  const normalized = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr
  const searchParams = new URLSearchParams(normalized)
  const result: RouterSearch = {}

  for (const [key, value] of searchParams.entries()) {
    appendSearchValue(result, key, parseRouterSearchValue(value))
  }

  return result
}

export function stringifyRouterSearch(search: RouterSearch): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(search ?? {})) {
    appendSearchParam(searchParams, key, value)
  }

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export function mergeRouterSearchPatch(search: RouterSearch, patch: RouterSearch): RouterSearch {
  const nextSearch: RouterSearch = { ...(search ?? {}) }

  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!key) {
      continue
    }

    if (isEmptyRouterSearchValue(value)) {
      delete nextSearch[key]
      continue
    }

    nextSearch[key] = value
  }

  return nextSearch
}

export function replaceCurrentRouterSearchPatch(patch: RouterSearch): RouterSearch {
  if (typeof window === 'undefined') {
    return mergeRouterSearchPatch({}, patch)
  }

  const nextSearch = mergeRouterSearchPatch(parseRouterSearch(window.location.search), patch)
  const queryString = stringifyRouterSearch(nextSearch)
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${queryString}${window.location.hash}`
  )
  return nextSearch
}

function appendSearchValue(result: RouterSearch, key: string, value: unknown) {
  const current = result[key]
  if (current === undefined) {
    result[key] = value
    return
  }

  if (Array.isArray(current)) {
    current.push(value)
    return
  }

  result[key] = [current, value]
}

function parseRouterSearchValue(value: string): unknown {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text)
    } catch {
      return value
    }
  }

  return value
}

function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: unknown
) {
  if (!key || value == null || value === '') {
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return
    }

    searchParams.set(key, JSON.stringify(value))
    return
  }

  if (typeof value === 'object') {
    searchParams.set(key, JSON.stringify(value))
    return
  }

  searchParams.set(key, String(value))
}

function isEmptyRouterSearchValue(value: unknown) {
  if (value == null || value === '') {
    return true
  }
  return Array.isArray(value) && value.length === 0
}
