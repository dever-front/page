import { resolveLucideIcon } from '@/lib/icon'
import { type NavItem, type NavLink, type SidebarData } from './types'

export type RemoteMenuItem = {
  name: string
  path?: string
  icon?: string
  num?: number
  active_paths?: string[]
  children?: RemoteMenuItem[]
}

export function getResolvedNavGroups(
  remoteMenu: RemoteMenuItem[] = []
): SidebarData['navGroups'] {
  return remoteMenu.length > 0 ? transformRemoteMenu(remoteMenu) : []
}

export function transformRemoteMenu(
  menu: RemoteMenuItem[]
): SidebarData['navGroups'] {
  return menu.map((group) => ({
    title: group.name,
    items: (group.children?.length ? group.children : [group]).map(toNavItem),
  }))
}

function toNavItem(item: RemoteMenuItem): NavItem {
  const children = item.children?.map(toNavLink).filter(hasUsableNavUrl) ?? []
  if (!hasMenuPath(item) && children.length > 0) {
    return {
      ...toBaseNavItem(item),
      items: children,
    }
  }

  return toNavLink(item)
}

function toNavLink(item: RemoteMenuItem): NavLink {
  return {
    ...toBaseNavItem(item),
    url: hasMenuPath(item)
      ? toAppUrl(item.path)
      : resolveFirstMenuItemUrl(item) || '#',
  }
}

function toBaseNavItem(item: RemoteMenuItem) {
  return {
    title: item.name,
    activePaths: Array.isArray(item.active_paths)
      ? item.active_paths.map((current) => toAppUrl(current))
      : undefined,
    badge: item.num ? String(item.num) : undefined,
    icon: resolveLucideIcon(item.icon),
  }
}

function hasUsableNavUrl(item: NavLink) {
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

  if (Array.isArray(item.children) && item.children.length > 0) {
    for (const child of item.children) {
      const matched = resolveFirstMenuItemUrl(child)
      if (matched) {
        return matched
      }
    }
  }

  const path = item.path?.trim()
  if (!path) {
    return ''
  }
  return toAppUrl(path)
}

function hasMenuPath(item: RemoteMenuItem) {
  return item.path?.trim() !== ''
}

function toAppUrl(path: string) {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '')
  return `/${normalized}`
}
