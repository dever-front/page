import { useEffect, useMemo, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useLayout } from '@/context/layout-provider'
import { useAuthStore } from '@/stores/auth-store'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { TeamSwitcher } from './team-switcher'
import {
  findRemoteMenuByKey,
  findPrimaryRemoteMenuByHref,
  getRemoteMenuKey,
  getScopedNavGroups,
  resolveFirstRemoteMenuKey,
  type RemoteMenuItem,
} from './menu'

type AppSidebarProps = {
  remoteMenu?: RemoteMenuItem[]
}

const PRIMARY_MENU_STORAGE_PREFIX = 'app-sidebar-primary-menu'

export function AppSidebar({ remoteMenu = [] }: AppSidebarProps) {
  const { collapsible, variant } = useLayout()
  const href = useLocation({
    select: (location) =>
      `${location.pathname || ''}${location.searchStr || ''}${location.hash || ''}`,
  })
  const user = useAuthStore((state) => state.auth.user)
  const primaryMenuStorageKey = useMemo(
    () => resolvePrimaryMenuStorageKey(user),
    [user]
  )
  const [selection, setSelection] = useState({
    storageKey: '',
    menuKey: '',
    href: '',
  })
  const routePrimaryMenuKey = useMemo(
    () => resolveRoutePrimaryMenuKey(remoteMenu, href),
    [href, remoteMenu]
  )
  const selectedPrimaryMenuKey = resolveSelectedPrimaryMenuKey(
    remoteMenu,
    selection.storageKey === primaryMenuStorageKey ? selection.menuKey : ''
  )
  const selectedPrimaryMenu = findRemoteMenuByKey(
    remoteMenu,
    selectedPrimaryMenuKey
  )
  const navGroups = getScopedNavGroups(selectedPrimaryMenu)

  useEffect(() => {
    const storedMenuKey = readSelectedPrimaryMenuKey(primaryMenuStorageKey)
    const nextMenuKey = resolveSelectedPrimaryMenuKey(
      remoteMenu,
      routePrimaryMenuKey || storedMenuKey
    )
    setSelection((current) => {
      if (
        current.storageKey === primaryMenuStorageKey &&
        current.href === href &&
        isRemoteMenuKeyValid(remoteMenu, current.menuKey)
      ) {
        return current
      }

      return {
        storageKey: primaryMenuStorageKey,
        menuKey: nextMenuKey,
        href,
      }
    })
    if (routePrimaryMenuKey) {
      writeSelectedPrimaryMenuKey(primaryMenuStorageKey, routePrimaryMenuKey)
    }
  }, [href, primaryMenuStorageKey, remoteMenu, routePrimaryMenuKey])

  const handlePrimaryMenuChange = (menuKey: string) => {
    const nextMenuKey = resolveSelectedPrimaryMenuKey(remoteMenu, menuKey)
    setSelection({
      storageKey: primaryMenuStorageKey,
      menuKey: nextMenuKey,
      href,
    })
    writeSelectedPrimaryMenuKey(primaryMenuStorageKey, nextMenuKey)
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher
          teams={sidebarData.teams}
          primaryMenus={remoteMenu}
          selectedPrimaryMenuKey={selectedPrimaryMenuKey}
          onSelectedPrimaryMenuKeyChange={handlePrimaryMenuChange}
        />

        {/* Replace <TeamSwitch /> with the following <AppTitle />
         /* if you want to use the normal app title instead of TeamSwitch dropdown */}
        {/* <AppTitle /> */}
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props, index) => (
          <NavGroup key={`${props.title || 'root'}-${index}`} {...props} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function resolvePrimaryMenuStorageKey(
  user: { id?: number; account?: string } | null
) {
  const userKey = String(user?.id || user?.account || 'anonymous').trim()
  return `${PRIMARY_MENU_STORAGE_PREFIX}:${userKey || 'anonymous'}`
}

function resolveSelectedPrimaryMenuKey(
  remoteMenu: RemoteMenuItem[],
  preferredMenuKey: string
) {
  const matchedMenu = findRemoteMenuByKey(remoteMenu, preferredMenuKey)
  if (matchedMenu) {
    return getRemoteMenuKey(matchedMenu)
  }
  return resolveFirstRemoteMenuKey(remoteMenu)
}

function isRemoteMenuKeyValid(remoteMenu: RemoteMenuItem[], menuKey: string) {
  const normalizedKey = String(menuKey || '').trim()
  return normalizedKey !== '' && !!findRemoteMenuByKey(remoteMenu, normalizedKey)
}

function resolveRoutePrimaryMenuKey(remoteMenu: RemoteMenuItem[], href: string) {
  const matchedMenu = findPrimaryRemoteMenuByHref(remoteMenu, href)
  return matchedMenu ? getRemoteMenuKey(matchedMenu) : ''
}

function readSelectedPrimaryMenuKey(storageKey: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return String(window.localStorage.getItem(storageKey) || '').trim()
  } catch {
    return ''
  }
}

function writeSelectedPrimaryMenuKey(storageKey: string, menuKey: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (menuKey) {
      window.localStorage.setItem(storageKey, menuKey)
    } else {
      window.localStorage.removeItem(storageKey)
    }
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}
