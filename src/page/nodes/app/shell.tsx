import { Outlet } from '@tanstack/react-router'
import { GlobalAssistant } from '@/components/assistant/global'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { useAppShell } from '@/components/layout/shell-context'
import { SkipToMain } from '@/components/skip-to-main'
import type { NodeItemProps } from '../../nodes'

export function AppSkipToMain() {
  return <SkipToMain />
}

export function AppSidebarNode() {
  const shell = useAppShell()
  return <AppSidebar remoteMenu={shell.menu} />
}

export function AppTopbarNode({ item }: NodeItemProps) {
  return <AppTopbar className={item.className} />
}

export function AppOutletNode() {
  const shell = useAppShell()
  return shell.children ?? <Outlet />
}

export function AppAssistantNode() {
  return <GlobalAssistant />
}
