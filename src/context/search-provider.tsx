import { createContext, useContext, useEffect, useState } from 'react'
import { CommandMenu } from '@/components/command-menu'
import { type SidebarData } from '@/components/layout/types'

type SearchContextType = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  navGroups: SidebarData['navGroups']
}

const SearchContext = createContext<SearchContextType | null>(null)

type SearchProviderProps = {
  children: React.ReactNode
  navGroups?: SidebarData['navGroups']
  enableCommandMenu?: boolean
}

export function SearchProvider({
  children,
  navGroups = [],
  enableCommandMenu = true,
}: SearchProviderProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enableCommandMenu) {
      return
    }

    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditable =
        !!target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"]'
        )

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
        return
      }

      if (!isEditable && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [enableCommandMenu])

  return (
    <SearchContext value={{ open, setOpen, navGroups }}>
      {children}
      {enableCommandMenu ? <CommandMenu /> : null}
    </SearchContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSearch = () => {
  const searchContext = useContext(SearchContext)

  if (!searchContext) {
    throw new Error('useSearch has to be used within SearchProvider')
  }

  return searchContext
}
