import type { PageStore } from './store'

type AppendRouteQueryOptions = {
  overwrite?: boolean
  objectMode?: 'json' | 'skip'
  skipPath?: boolean
  skipKeys?: string[]
}

export function normalizeRoutePagePath(path: unknown) {
  return String(path ?? '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
}

export function mergeRouteQueryParams(
  route: unknown,
  overrides: Record<string, unknown> = {}
) {
  const [, rawQuery = ''] = String(route ?? '').split('?')
  return {
    ...Object.fromEntries(new URLSearchParams(rawQuery).entries()),
    ...overrides,
  }
}

export function appendStoreRouteQueryParams(
  params: URLSearchParams,
  store: PageStore,
  options?: AppendRouteQueryOptions
) {
  appendRouteQueryParams(params, store.getState().state?.route?.query, options)
}

export function appendRouteQueryParams(
  params: URLSearchParams,
  routeQuery: unknown,
  options: AppendRouteQueryOptions = {}
) {
  if (
    !routeQuery ||
    typeof routeQuery !== 'object' ||
    Array.isArray(routeQuery)
  ) {
    return
  }

  const skipKeys = new Set([
    ...(options.skipPath === false ? [] : ['path']),
    ...(options.skipKeys ?? []),
  ])
  for (const [key, value] of Object.entries(routeQuery)) {
    appendRouteQueryParamValue(
      params,
      key,
      value,
      skipKeys,
      options.overwrite === true,
      options.objectMode ?? 'json'
    )
  }
}

function appendRouteQueryParamValue(
  params: URLSearchParams,
  key: string,
  value: unknown,
  skipKeys: Set<string>,
  overwrite: boolean,
  objectMode: 'json' | 'skip'
) {
  const queryKey = String(key || '').trim()
  if (!queryKey || skipKeys.has(queryKey)) {
    return
  }
  if (value == null) {
    if (overwrite) {
      params.delete(queryKey)
    }
    return
  }
  if (!overwrite && hasNonEmptySearchParam(params, queryKey)) {
    return
  }

  if (Array.isArray(value)) {
    params.delete(queryKey)
    for (const item of value) {
      appendSingleRouteQueryParamValue(params, queryKey, item, objectMode)
    }
    return
  }

  params.delete(queryKey)
  appendSingleRouteQueryParamValue(params, queryKey, value, objectMode)
}

function hasNonEmptySearchParam(params: URLSearchParams, key: string) {
  return params.getAll(key).some((value) => String(value ?? '').trim() !== '')
}

function appendSingleRouteQueryParamValue(
  params: URLSearchParams,
  key: string,
  value: unknown,
  objectMode: 'json' | 'skip'
) {
  if (value == null) {
    return
  }

  if (typeof value === 'object') {
    if (objectMode === 'json') {
      params.append(key, JSON.stringify(value))
    }
    return
  }

  const queryValue = String(value).trim()
  if (queryValue) {
    params.append(key, queryValue)
  }
}
