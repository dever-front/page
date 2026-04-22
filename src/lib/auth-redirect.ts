import { canAccessRoute } from '@/lib/permission'
import { parseInternalNavigationHref, type NavigationTarget } from '@/lib/navigation'
import type { AuthRule } from '@/stores/auth-store'

type RedirectMenuItem = {
  path?: string
  children?: RedirectMenuItem[]
}

type AuthRedirectInput = {
  redirectTo?: string
  entry?: string
  menu?: RedirectMenuItem[]
  auth?: string[]
  authRules?: AuthRule[]
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
  const auth = input.auth ?? []
  const authRules = input.authRules ?? []
  const redirectTarget = parseAllowedRedirect(input.redirectTo, auth, authRules)

  if (redirectTarget) {
    return redirectTarget
  }

  const entryTarget = parseAllowedRedirect(toAppPath(input.entry), auth, authRules)
  if (entryTarget) {
    return entryTarget
  }

  const firstMenuUrl = resolveFirstMenuUrl(input.menu ?? [])
  const firstMenuTarget = parseAllowedRedirect(firstMenuUrl, auth, authRules)
  if (firstMenuTarget) {
    return firstMenuTarget
  }

  return { to: '/' }
}

function parseAllowedRedirect(
  redirectTo: unknown,
  auth: string[],
  authRules: AuthRule[]
) {
  const target = parseInternalNavigationHref(redirectTo)
  if (!target || isBlockedRedirectPath(target.to)) {
    return null
  }

  if (!canAccessRoute(target.to, target.search, auth, authRules)) {
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

function isBlockedRedirectPath(path: string) {
  const normalizedPath = `/${String(path || '').replace(/^\/+/, '')}`
  return BLOCKED_REDIRECT_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
}
