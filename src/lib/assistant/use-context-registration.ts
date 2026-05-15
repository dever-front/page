import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PageStore } from '@/lib/store'
import type { AssistantPageContext } from './context'
import {
  activateAssistantPage,
  notifyAssistantPageChanged,
  registerAssistantPage,
  type AssistantPageScope,
} from './registry'

type AssistantContextRegistrationOptions = {
  context: AssistantPageContext
  store: PageStore
  enabled?: boolean
  scope?: AssistantPageScope
  route?: string
  name?: string
  applyFormValues: (values: Record<string, unknown>) => void | Promise<void>
}

export function useAssistantContextRegistration({
  context,
  store,
  enabled = true,
  scope = 'page',
  route,
  name,
  applyFormValues,
}: AssistantContextRegistrationOptions) {
  const idRef = useRef('')
  const contextRef = useRef(context)
  const applyFormValuesRef = useRef(applyFormValues)

  if (!idRef.current) {
    idRef.current = createAssistantContextID(scope, name)
  }

  const registrationID = idRef.current
  const activeRoute = route || context.route || store.getState().pagePath || ''
  const contextSignature = useMemo(
    () => assistantContextSignature(context),
    [context]
  )

  useEffect(() => {
    contextRef.current = context
    applyFormValuesRef.current = applyFormValues
  }, [applyFormValues, context])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let disposed = false
    const unregister = registerAssistantPage({
      id: registrationID,
      store,
      route: activeRoute,
      scope,
      getContext: () => contextRef.current,
      applyFormValues: (values) => applyFormValuesRef.current(values),
    })
    window.queueMicrotask(() => {
      if (!disposed) {
        activateAssistantPage(registrationID)
      }
    })

    return () => {
      disposed = true
      unregister()
    }
  }, [activeRoute, enabled, registrationID, scope, store])

  useEffect(() => {
    if (enabled) {
      notifyAssistantPageChanged(registrationID)
    }
  }, [contextSignature, enabled, registrationID])

  return useCallback(() => {
    if (enabled) {
      activateAssistantPage(registrationID)
    }
  }, [enabled, registrationID])
}

function createAssistantContextID(scope: AssistantPageScope, name?: string) {
  const scopeName = String(name || scope).replace(/\s+/g, '-')
  return `assistant-context:${scopeName}:${Math.random().toString(16).slice(2)}`
}

function assistantContextSignature(context: AssistantPageContext) {
  const fields = context.form?.fields ?? []
  return JSON.stringify({
    scope: context.scope,
    route: context.route,
    page: context.page,
    fields: fields.map((field) => ({
      path: field.path,
      name: field.name,
      type: field.type,
      required: field.required === true,
    })),
  })
}
