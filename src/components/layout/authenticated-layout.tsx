import { Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { getDefaultSidebarOpen } from '@/config/app-config'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { FrontBootScreen } from '@/components/layout/front-boot-screen'
import { SkipToMain } from '@/components/skip-to-main'
import {
  FRONT_RUNTIME_REFRESH_EVENT,
  loadMainInfo,
  type FrontRuntimeRefreshDetail,
} from '@/lib/request'
import { getResolvedNavGroups } from '@/components/layout/menu'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const savedSidebarState = getCookie('sidebar_state')
  const defaultOpen =
    savedSidebarState == null ? getDefaultSidebarOpen() : savedSidebarState !== 'false'
  const [bootState, setBootState] = useState<{
    ready: boolean
    menu: any[]
  }>({
    ready: false,
    menu: [],
  })

  useEffect(() => {
    let active = true
    let requestSeq = 0

    async function bootstrap() {
      const seq = ++requestSeq
      const { menu } = await loadMainInfo()
      if (!active || seq !== requestSeq) return

      setBootState({
        ready: true,
        menu,
      })
    }

    function handleRuntimeRefresh(event: Event) {
      const detail = (event as CustomEvent<FrontRuntimeRefreshDetail>).detail
      if (detail?.reason !== 'main-sync' && detail?.reason !== 'manual') {
        return
      }
      void bootstrap()
    }

    void bootstrap()
    window.addEventListener(FRONT_RUNTIME_REFRESH_EVENT, handleRuntimeRefresh)
    return () => {
      active = false
      window.removeEventListener(FRONT_RUNTIME_REFRESH_EVENT, handleRuntimeRefresh)
    }
  }, [])

  if (!bootState.ready) {
    return <FrontBootScreen />
  }

  const navGroups = getResolvedNavGroups(bootState.menu)

  return (
    <SearchProvider navGroups={navGroups}>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar remoteMenu={bootState.menu} />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            <AppTopbar />
            <div className='flex min-h-0 flex-1 flex-col'>
              {children ?? <Outlet />}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
