import { useEffect, useState } from 'react'
import { getDefaultSidebarOpen, getRuntimeConfig } from '@/config/app-config'
import { Page } from '@/page/page'
import { getCookie } from '@/lib/cookies'
import {
  FRONT_RUNTIME_REFRESH_EVENT,
  loadMainBootstrap,
  type FrontRuntimeRefreshDetail,
} from '@/lib/request'
import { systemPageRoute } from '@/lib/system-page-route'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { FrontBootFallback } from '@/components/layout/front-boot-screen'
import { getResolvedNavGroups } from '@/components/layout/menu'
import { AppShellProvider } from '@/components/layout/shell-context'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  if (getRuntimeConfig().shell === 'blank') {
    return <BlankShellLayout>{children}</BlankShellLayout>
  }

  return <AppShellLayout>{children}</AppShellLayout>
}

function AppShellLayout({ children }: AuthenticatedLayoutProps) {
  const mainRoute = systemPageRoute('main')
  const savedSidebarState = getCookie('sidebar_state')
  const defaultOpen =
    savedSidebarState == null
      ? getDefaultSidebarOpen()
      : savedSidebarState !== 'false'
  const [bootState, setBootState] = useState<{
    ready: boolean
    menu: any[]
    shellSchema: any | null
  }>({
    ready: false,
    menu: [],
    shellSchema: null,
  })

  useEffect(() => {
    let active = true
    let requestSeq = 0

    async function bootstrap() {
      const seq = ++requestSeq
      const { main, schema } = await loadMainBootstrap(mainRoute)
      if (!active || seq !== requestSeq) return

      setBootState({
        ready: true,
        menu: main.menu,
        shellSchema: schema,
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
      window.removeEventListener(
        FRONT_RUNTIME_REFRESH_EVENT,
        handleRuntimeRefresh
      )
    }
  }, [mainRoute])

  if (!bootState.ready) {
    return <FrontBootFallback />
  }

  const navGroups = getResolvedNavGroups(bootState.menu)
  const shellValue = {
    menu: bootState.menu,
    navGroups,
    children,
  }

  return (
    <SearchProvider navGroups={navGroups}>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppShellProvider value={shellValue}>
            <Page
              route={mainRoute}
              schema={bootState.shellSchema ?? defaultMainSchema}
              updateDocumentTitle={false}
              assistantScope='nested'
            />
          </AppShellProvider>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}

const blankMenu: any[] = []
const blankNavGroups: any[] = []

function BlankShellLayout({ children }: AuthenticatedLayoutProps) {
  const mainRoute = systemPageRoute('main')
  const shellValue = {
    menu: blankMenu,
    navGroups: blankNavGroups,
    children,
  }

  return (
    <SearchProvider navGroups={blankNavGroups} enableCommandMenu={false}>
      <LayoutProvider>
        <AppShellProvider value={shellValue}>
          <Page
            route={mainRoute}
            updateDocumentTitle={false}
            assistantScope='nested'
          />
        </AppShellProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}

const defaultMainSchema = {
  page: {
    name: '主框架',
  },
  layout: {
    type: 'container',
    children: {
      sidebar: {
        type: 'container',
      },
      shell: {
        type: 'shell-sidebar-inset',
        children: {
          topbar: {
            type: 'container',
          },
          content: {
            type: 'container',
            className: 'flex min-h-0 flex-1 flex-col',
          },
        },
      },
      assistant: {
        type: 'container',
      },
    },
  },
  nodes: {
    __root__: [
      {
        type: 'app-skip-to-main',
      },
    ],
    sidebar: [
      {
        type: 'app-sidebar',
      },
    ],
    topbar: [
      {
        type: 'app-topbar',
      },
    ],
    content: [
      {
        type: 'app-outlet',
      },
    ],
    assistant: [
      {
        type: 'app-assistant',
      },
    ],
  },
  data: {},
  state: {},
  action: {},
}
