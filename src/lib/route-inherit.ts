import type { PageStore } from './store'

export function buildInheritedPageRoute(route: string, store: PageStore) {
  const currentRoute = String(route || '').trim()
  if (!currentRoute) {
    return ''
  }

  const [pathname, rawQuery = ''] = currentRoute.split('?')
  const parentRoute = String(
    store.getState().pagePath || store.getState().schema.page?.route || ''
  )
  const [parentPath, parentRawQuery = ''] = parentRoute.split('?')
  const normalizedParentPath = normalizeRoutePath(parentPath)
  if (!normalizedParentPath) {
    return currentRoute
  }

  const searchParams = new URLSearchParams(rawQuery)
  searchParams.set('_inherit', 'form')
  searchParams.set('_parentPath', normalizedParentPath)

  for (const [key, value] of new URLSearchParams(parentRawQuery).entries()) {
    appendParentQueryValue(searchParams, key, value)
  }

  const routeQuery = store.getState().state?.route?.query
  if (routeQuery && typeof routeQuery === 'object' && !Array.isArray(routeQuery)) {
    for (const [key, value] of Object.entries(routeQuery)) {
      appendParentQueryValue(searchParams, key, value)
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

function appendParentQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: unknown
) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey || value == null || value === '') {
    return
  }

  const targetKey = `_parent_${normalizedKey}`
  searchParams.delete(targetKey)

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item != null && String(item).trim() !== '') {
        searchParams.append(targetKey, String(item))
      }
    }
    return
  }

  searchParams.set(targetKey, String(value))
}

function normalizeRoutePath(path: string) {
  return path.replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
}
