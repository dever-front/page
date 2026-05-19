import { parseInternalNavigationHref, type NavigationTarget } from '@/lib/navigation'
import { stripRouterBasePath } from '@/lib/router-path'

type RedirectMenuItem = {
  path?: string
  active_paths?: string[]
  children?: RedirectMenuItem[]
}

type AuthRedirectInput = {
  redirectTo?: string
  entry?: string
  menu?: RedirectMenuItem[]
}

const BLOCKED_REDIRECT_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/otp',
  '/401',
  '/403',
  '/404',
  '/500',
  '/503',
]

export function resolvePostLoginTarget(input: AuthRedirectInput): NavigationTarget {
  const menuPaths = collectMenuPaths(input.menu ?? [])
  const redirectTarget = parseAllowedRedirect(input.redirectTo, menuPaths)

  if (redirectTarget) {
    return redirectTarget
  }

  const entryTarget = parseAllowedRedirect(toAppPath(input.entry), menuPaths)
  if (entryTarget) {
    return entryTarget
  }

  const firstMenuUrl = resolveFirstMenuUrl(input.menu ?? [])
  const firstMenuTarget = parseAllowedRedirect(firstMenuUrl, menuPaths)
  if (firstMenuTarget) {
    return firstMenuTarget
  }

  return { to: '/' }
}

function parseAllowedRedirect(redirectTo: unknown, menuPaths: Set<string>) {
  const target = parseInternalNavigationHref(redirectTo)
  if (!target || isBlockedRedirectPath(target.to)) {
    return null
  }

  if (!menuPaths.has(normalizeMenuPath(target.to))) {
    return null
  }

  return target
}

function toAppPath(path?: string) {
  const normalized = String(path || '').trim().replace(/^\/+/, '')
  return normalized ? `/${normalized}` : ''
}

function resolveFirstMenuUrl(menu: RedirectMenuItem[]) {
  for (const item of menu) {
    const matched = resolveFirstMenuItemUrl(item)
    if (matched) {
      return matched
    }
  }
  return ''
}

function resolveFirstMenuItemUrl(item?: RedirectMenuItem): string {
  if (!item) {
    return ''
  }

  for (const child of item.children ?? []) {
    const matched = resolveFirstMenuItemUrl(child)
    if (matched) {
      return matched
    }
  }

  return toAppPath(item.path)
}

function collectMenuPaths(menu: RedirectMenuItem[]) {
  const paths = new Set<string>()
  for (const item of menu) {
    collectMenuItemPaths(item, paths)
  }
  return paths
}

function collectMenuItemPaths(item: RedirectMenuItem | undefined, paths: Set<string>) {
  if (!item) {
    return
  }

  addMenuPath(paths, item.path)
  for (const path of item.active_paths ?? []) {
    addMenuPath(paths, path)
  }
  for (const child of item.children ?? []) {
    collectMenuItemPaths(child, paths)
  }
}

function addMenuPath(paths: Set<string>, path: unknown) {
  const normalized = normalizeMenuPath(path)
  if (normalized) {
    paths.add(normalized)
  }
}

function normalizeMenuPath(path: unknown) {
  return stripRouterBasePath(path).replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
}

function isBlockedRedirectPath(path: string) {
  const normalizedPath = `/${String(path || '').replace(/^\/+/, '')}`
  return BLOCKED_REDIRECT_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
}
