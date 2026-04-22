export const PAGE_RELOAD_EVENT = 'app:page-reload'

export type PageReloadDetail = {
  route: string
}

export function emitPageReload(route: string) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedRoute = normalizePageReloadRoute(route)
  if (!normalizedRoute) {
    return
  }

  window.dispatchEvent(
    new CustomEvent<PageReloadDetail>(PAGE_RELOAD_EVENT, {
      detail: { route: normalizedRoute },
    })
  )
}

export function isSamePageReloadRoute(currentRoute: string, targetRoute: string) {
  return normalizePageReloadRoute(currentRoute) === normalizePageReloadRoute(targetRoute)
}

function normalizePageReloadRoute(route: string) {
  const normalized = String(route || '').trim()
  if (!normalized) {
    return ''
  }

  const [pathname, query = ''] = normalized.split('?')
  const normalizedPath = pathname.replace(/^\/+/, '/').replace(/\/+$/, '') || '/'
  const normalizedQuery = new URLSearchParams(query).toString()
  return normalizedQuery ? `${normalizedPath}?${normalizedQuery}` : normalizedPath
}
