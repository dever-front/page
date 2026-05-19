import { resolveLucideIcon } from '@/lib/icon'
import { stripRouterBasePath } from '@/lib/router-path'
import { type NavItem, type NavLink, type SidebarData } from './types'

export type RemoteMenuItem = {
  key?: string
  id?: string
  name: string
  title?: string
  path?: string
  url?: string
  icon?: string
  num?: number
  active_paths?: string[]
  activePaths?: string[]
  children?: RemoteMenuItem[]
  items?: RemoteMenuItem[]
}

export function getResolvedNavGroups(
  remoteMenu: RemoteMenuItem[] = []
): SidebarData['navGroups'] {
  return remoteMenu.length > 0 ? transformRemoteMenu(remoteMenu) : []
}

export function getScopedNavGroups(
  primaryMenu?: RemoteMenuItem | null
): SidebarData['navGroups'] {
  if (!primaryMenu) {
    return []
  }

  const children = getRemoteMenuChildren(primaryMenu)
  if (children.length === 0) {
    const item = toNavItem(primaryMenu)
    return hasUsableNavItem(item) ? [{ title: '', items: [item] }] : []
  }

  const groups: SidebarData['navGroups'] = []
  let leafItems: NavItem[] = []

  const flushLeafItems = () => {
    if (leafItems.length === 0) {
      return
    }
    groups.push({ title: '', items: leafItems })
    leafItems = []
  }

  for (const child of children) {
    const childChildren = getRemoteMenuChildren(child)
    if (childChildren.length === 0) {
      const item = toNavItem(child)
      if (hasUsableNavItem(item)) {
        leafItems.push(item)
      }
      continue
    }

    flushLeafItems()
    const items = childChildren.map(toNavItem).filter(hasUsableNavItem)
    if (items.length > 0) {
      groups.push({
        title: getRemoteMenuTitle(child),
        items,
      })
    }
  }

  flushLeafItems()
  return groups
}

export function getRemoteMenuKey(item: RemoteMenuItem) {
  return String(
    item.key || item.id || item.path || item.url || item.name || item.title || ''
  ).trim()
}

export function getRemoteMenuTitle(item: RemoteMenuItem) {
  return String(item.name || item.title || getRemoteMenuKey(item)).trim()
}

export function findRemoteMenuByKey(menu: RemoteMenuItem[], key: string) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) {
    return null
  }
  return menu.find((item) => remoteMenuMatchesKey(item, normalizedKey)) ?? null
}

export function findPrimaryRemoteMenuByHref(
  menu: RemoteMenuItem[],
  href: string
) {
  const currentPath = normalizeAppPath(href)
  if (!currentPath) {
    return null
  }
  return menu.find((item) => remoteMenuContainsPath(item, currentPath)) ?? null
}

export function resolveFirstRemoteMenuKey(menu: RemoteMenuItem[]) {
  for (const item of menu) {
    const key = getRemoteMenuKey(item)
    if (key) {
      return key
    }
  }
  return ''
}

function remoteMenuMatchesKey(item: RemoteMenuItem, key: string) {
  const normalizedKey = String(key || '').trim()
  return (
    normalizedKey !== '' &&
    (getRemoteMenuKey(item) === normalizedKey ||
      getRemoteMenuTitle(item) === normalizedKey)
  )
}

export function transformRemoteMenu(
  menu: RemoteMenuItem[]
): SidebarData['navGroups'] {
  return menu.map((group) => ({
    title: getRemoteMenuTitle(group),
    items: (getRemoteMenuChildren(group).length
      ? getRemoteMenuChildren(group)
      : [group])
      .map(toNavItem)
      .filter(hasUsableNavItem),
  }))
}

function toNavItem(item: RemoteMenuItem): NavItem {
  const children = getRemoteMenuChildren(item)
    .map(toNavItem)
    .filter(hasUsableNavItem)
  if (children.length > 0) {
    return {
      ...toBaseNavItem(item),
      items: hasMenuPath(item) ? [toNavLink(item), ...children] : children,
    }
  }

  return toNavLink(item)
}

function toNavLink(item: RemoteMenuItem): NavLink {
  return {
    ...toBaseNavItem(item),
    url: hasMenuPath(item)
      ? toAppUrl(getMenuPath(item))
      : resolveFirstMenuItemUrl(item) || '#',
  }
}

function toBaseNavItem(item: RemoteMenuItem) {
  const activePaths = Array.isArray(item.active_paths)
    ? item.active_paths
    : item.activePaths
  return {
    title: item.name || item.title || '',
    activePaths: Array.isArray(activePaths)
      ? activePaths.map((current) => toAppUrl(current))
      : undefined,
    badge: item.num ? String(item.num) : undefined,
    icon: resolveLucideIcon(item.icon),
  }
}

function hasUsableNavItem(item: NavItem) {
  if ('items' in item) {
    return item.items.length > 0
  }
  return item.url !== '#'
}

export function resolveFirstRemoteMenuUrl(menu: RemoteMenuItem[] = []) {
  for (const item of menu) {
    const matched = resolveFirstMenuItemUrl(item)
    if (matched) {
      return matched
    }
  }
  return ''
}

function resolveFirstMenuItemUrl(item?: RemoteMenuItem) {
  if (!item) {
    return ''
  }

  const children = getRemoteMenuChildren(item)
  if (children.length > 0) {
    for (const child of children) {
      const matched = resolveFirstMenuItemUrl(child)
      if (matched) {
        return matched
      }
    }
  }

  const path = getMenuPath(item)
  if (!path) {
    return ''
  }
  return toAppUrl(path)
}

function hasMenuPath(item: RemoteMenuItem) {
  return getMenuPath(item) !== ''
}

function getMenuPath(item: RemoteMenuItem) {
  return String(item.path || item.url || '').trim()
}

function getRemoteMenuChildren(item: RemoteMenuItem) {
  if (Array.isArray(item.children)) {
    return item.children
  }
  if (Array.isArray(item.items)) {
    return item.items
  }
  return []
}

function toAppUrl(path: string) {
  const normalized = normalizeAppPath(path)
  if (!normalized) {
    return '/'
  }
  return normalized
}

function remoteMenuContainsPath(item: RemoteMenuItem, currentPath: string): boolean {
  const menuPath = normalizeAppPath(getMenuPath(item))
  if (menuPath && pathsMatch(currentPath, menuPath)) {
    return true
  }

  const activePaths = Array.isArray(item.active_paths)
    ? item.active_paths
    : item.activePaths
  if (
    Array.isArray(activePaths) &&
    activePaths.some((activePath) =>
      pathsMatch(currentPath, normalizeAppPath(activePath))
    )
  ) {
    return true
  }

  return getRemoteMenuChildren(item).some((child) =>
    remoteMenuContainsPath(child, currentPath)
  )
}

function pathsMatch(currentPath: string, candidatePath: string) {
  if (!currentPath || !candidatePath) {
    return false
  }
  return (
    currentPath === candidatePath ||
    currentPath.startsWith(`${candidatePath}/`) ||
    candidatePath.startsWith(`${currentPath}/`)
  )
}

function normalizeAppPath(path: string) {
  const rawPath = String(path || '').trim()
  let pathname = rawPath

  try {
    if (/^https?:\/\//i.test(rawPath)) {
      pathname = new URL(rawPath).pathname
    }
  } catch {
    pathname = rawPath
  }

  pathname = stripRouterBasePath(pathname).split('?')[0].split('#')[0].trim()
  const normalized = pathname.replace(/^\/+|\/+$/g, '')
  if (!normalized) {
    return ''
  }
  return `/${normalized}`
}
