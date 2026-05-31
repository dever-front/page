import { createContext, useContext } from 'react'
import type { RemoteMenuItem } from './menu'
import type { NavGroup } from './types'

export type AppShellContextValue = {
  menu: RemoteMenuItem[]
  navGroups: NavGroup[]
  children?: React.ReactNode
}

const AppShellContext = createContext<AppShellContextValue>({
  menu: [],
  navGroups: [],
})

export function AppShellProvider({
  value,
  children,
}: {
  value: AppShellContextValue
  children: React.ReactNode
}) {
  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  )
}

export function useAppShell() {
  return useContext(AppShellContext)
}
