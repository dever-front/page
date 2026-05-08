import { normalizeRouteKey } from './route-key'

export const PAGE_RELOAD_EVENT = 'app:page-reload'

export type PageReloadDetail = {
  route: string
}

const reloadingRoutes = new Set<string>()

export function emitPageReload(route: string) {
  if (typeof window === 'undefined') {
    return false
  }

  const normalizedRoute = normalizeRouteKey(route)
  if (!normalizedRoute || reloadingRoutes.has(normalizedRoute)) {
    return false
  }

  reloadingRoutes.add(normalizedRoute)
  window.dispatchEvent(
    new CustomEvent<PageReloadDetail>(PAGE_RELOAD_EVENT, {
      detail: { route: normalizedRoute },
    })
  )
  return true
}

export function finishPageReload(route: string) {
  const normalizedRoute = normalizeRouteKey(route)
  if (!normalizedRoute) {
    return
  }

  reloadingRoutes.delete(normalizedRoute)
}

export function isSamePageReloadRoute(currentRoute: string, targetRoute: string) {
  return normalizeRouteKey(currentRoute) === normalizeRouteKey(targetRoute)
}
