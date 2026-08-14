import { createContext, useContext, type ReactNode } from 'react'
import type { ReferenceUsageField, ReferenceUsageOption } from './types'

type ReferenceNodeRuntimeOptions = {
  usageOptions: ReferenceUsageOption[]
  usageField: ReferenceUsageField
  mediaUsageOptions: ReferenceUsageOption[]
}

const ReferenceNodeRuntimeContext =
  createContext<ReferenceNodeRuntimeOptions | null>(null)

export function ReferenceNodeRuntimeProvider({
  value,
  children,
}: {
  value: ReferenceNodeRuntimeOptions
  children: ReactNode
}) {
  return (
    <ReferenceNodeRuntimeContext.Provider value={value}>
      {children}
    </ReferenceNodeRuntimeContext.Provider>
  )
}

export function useReferenceNodeRuntime() {
  return useContext(ReferenceNodeRuntimeContext)
}
