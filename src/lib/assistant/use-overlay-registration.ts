import { useCallback, useEffect, useRef } from 'react'
import type { PageStore } from '@/lib/store'
import {
  activateAssistantPage,
  registerAssistantPage,
  type AssistantPageScope,
} from './registry'

type AssistantOverlayScope = Extract<AssistantPageScope, 'modal' | 'drawer'>

type AssistantOverlayRegistrationOptions = {
  open: boolean
  store: PageStore
  scope: AssistantOverlayScope
  route?: string
  name?: string
}

export function useAssistantOverlayRegistration({
  open,
  store,
  scope,
  route,
  name,
}: AssistantOverlayRegistrationOptions) {
  const idRef = useRef('')
  if (!idRef.current) {
    idRef.current = createAssistantOverlayID(scope, name)
  }

  const registrationID = idRef.current
  const activeRoute = String(route || store.getState().pagePath || '')

  useEffect(() => {
    if (!open) {
      return
    }

    return registerAssistantPage({
      id: registrationID,
      store,
      route: activeRoute,
      scope,
    })
  }, [activeRoute, open, registrationID, scope, store])

  return useCallback(() => {
    if (open) {
      activateAssistantPage(registrationID)
    }
  }, [open, registrationID])
}

function createAssistantOverlayID(scope: AssistantOverlayScope, name?: string) {
  const scopeName = String(name || scope).replace(/\s+/g, '-')
  return `assistant-${scope}:${scopeName}:${Math.random().toString(16).slice(2)}`
}
