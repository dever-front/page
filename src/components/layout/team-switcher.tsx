import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { resolveLucideIcon } from '@/lib/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  getRemoteMenuKey,
  getRemoteMenuTitle,
  type RemoteMenuItem,
} from './menu'
import { SiteLogo } from './site-logo'

type TeamSwitcherProps = {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
  primaryMenus?: RemoteMenuItem[]
  selectedPrimaryMenuKey?: string
  onSelectedPrimaryMenuKeyChange?: (key: string) => void
}

export function TeamSwitcher({
  teams,
  primaryMenus = [],
  selectedPrimaryMenuKey = '',
  onSelectedPrimaryMenuKeyChange,
}: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const activeTeam = React.useMemo(() => teams[0], [teams])
  if (!activeTeam) {
    return null
  }

  const selectedPrimaryMenu = primaryMenus.find(
    (item) => getRemoteMenuKey(item) === selectedPrimaryMenuKey
  )
  const selectedPrimaryMenuName = selectedPrimaryMenu
    ? getRemoteMenuTitle(selectedPrimaryMenu)
    : ''
  const menuButton = (
    <SidebarMenuButton
      type='button'
      className='h-12 gap-2 rounded-md p-2 text-sm group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:p-0! focus-visible:ring-0 data-[state=open]:ring-0'
    >
      <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
        <SiteLogo className='size-[1.125rem]' />
      </div>
      <div className='grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden'>
        <span className='truncate font-semibold'>{activeTeam.name}</span>
        <span className='truncate text-xs'>
          {selectedPrimaryMenuName || activeTeam.plan}
        </span>
      </div>
      {primaryMenus.length > 0 && (
        <ChevronsUpDown className='ms-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden' />
      )}
    </SidebarMenuButton>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {primaryMenus.length === 0 ? (
          menuButton
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{menuButton}</DropdownMenuTrigger>
            <DropdownMenuContent
              align='start'
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            >
              <DropdownMenuLabel className='text-xs text-muted-foreground'>
                功能列表
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {primaryMenus.map((item) => {
                const key = getRemoteMenuKey(item)
                const Icon = resolveLucideIcon(item.icon) ?? activeTeam.logo
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => onSelectedPrimaryMenuKeyChange?.(key)}
                    className='gap-2 p-2'
                  >
                    <div className='flex size-6 items-center justify-center rounded-sm border'>
                      <Icon className='size-4 shrink-0' />
                    </div>
                    <span className='min-w-0 flex-1 truncate'>
                      {getRemoteMenuTitle(item)}
                    </span>
                    {key === selectedPrimaryMenuKey && (
                      <Check className='ms-auto size-4 text-muted-foreground' />
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
