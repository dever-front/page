import type { PageStore } from '@/lib/store'
import type { AssistantPageContext } from './context'

export type AssistantPageScope = 'page' | 'modal' | 'drawer' | 'nested'

export type AssistantPageRegistration = {
  id: string
  store: PageStore
  scope: AssistantPageScope
  route: string
  getContext?: () => AssistantPageContext | null
  applyFormValues?: (values: Record<string, unknown>) => void | Promise<void>
}

type RegistryListener = () => void

const registrations = new Map<string, AssistantPageRegistration>()
const activeIds: string[] = []
const listeners = new Set<RegistryListener>()
let registryVersion = 0

export function registerAssistantPage(
  registration: Omit<AssistantPageRegistration, 'id'> & { id?: string }
) {
  const id = registration.id || createAssistantPageID()
  registrations.set(id, {
    id,
    store: registration.store,
    scope: registration.scope,
    route: registration.route,
    getContext: registration.getContext,
    applyFormValues: registration.applyFormValues,
  })
  activateAssistantPage(id)

  return () => {
    registrations.delete(id)
    removeActiveID(id)
    notifyRegistryListeners()
  }
}

export function activateAssistantPage(id: string) {
  if (!registrations.has(id)) {
    return
  }
  removeActiveID(id)
  activeIds.push(id)
  notifyRegistryListeners()
}

export function getActiveAssistantPage() {
  for (let index = activeIds.length - 1; index >= 0; index--) {
    const registration = registrations.get(activeIds[index])
    if (registration) {
      return registration
    }
  }
  return null
}

export function findAssistantPage(
  match: (registration: AssistantPageRegistration) => boolean
) {
  for (let index = activeIds.length - 1; index >= 0; index--) {
    const registration = registrations.get(activeIds[index])
    if (registration && match(registration)) {
      return registration
    }
  }

  for (const registration of registrations.values()) {
    if (match(registration)) {
      return registration
    }
  }
  return null
}

export function subscribeAssistantRegistry(listener: RegistryListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyAssistantPageChanged(id?: string) {
  if (id && !registrations.has(id)) {
    return
  }
  notifyRegistryListeners()
}

export function getAssistantRegistryVersion() {
  const active = getActiveAssistantPage()
  return `${registryVersion}:${active?.id || ''}:${registrations.size}`
}

function removeActiveID(id: string) {
  let index = activeIds.indexOf(id)
  while (index >= 0) {
    activeIds.splice(index, 1)
    index = activeIds.indexOf(id)
  }
}

function notifyRegistryListeners() {
  registryVersion += 1
  listeners.forEach((listener) => listener())
}

function createAssistantPageID() {
  return `assistant-page-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
