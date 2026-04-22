import * as React from 'react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

type TeamSwitcherProps = {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const activeTeam = React.useMemo(() => teams[0], [teams])
  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* 先保留静态展示，后续 project 切换再恢复成 dropdown。 */}
        <SidebarMenuButton
          type='button'
          className='h-12 cursor-default gap-2 rounded-md p-2 text-sm hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:p-0!'
        >
          <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
            <activeTeam.logo className='size-[1.125rem]' />
          </div>
          <div className='grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden'>
            <span className='truncate font-semibold'>{activeTeam.name}</span>
            <span className='truncate text-xs'>{activeTeam.plan}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
