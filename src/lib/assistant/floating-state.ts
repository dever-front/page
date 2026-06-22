import { useSyncExternalStore } from 'react'

type AssistantFloatingUser = {
  id?: number | string | null
  account?: string | null
} | null | undefined

const ASSISTANT_FLOATING_KEY_PREFIX = 'dever:assistant-floating:'

const listeners = new Set<() => void>()
const blockedModalIds = new Set<string>()

function emitAssistantFloatingChange() {
  listeners.forEach((listener) => listener())
}

function subscribeAssistantFloatingChange(listener: () => void) {
  listeners.add(listener)
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', listener)
  }
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', listener)
    }
  }
}

function resolveAssistantFloatingStorageKey(userKey: string) {
  return `${ASSISTANT_FLOATING_KEY_PREFIX}${userKey || 'anonymous'}`
}

export function getAssistantFloatingUserKey(user: AssistantFloatingUser) {
  return String(user?.id || user?.account || 'anonymous').trim() || 'anonymous'
}

export function getAssistantFloatingEnabled(userKey: string) {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(resolveAssistantFloatingStorageKey(userKey)) === '1'
  } catch {
    return false
  }
}

export function setAssistantFloatingEnabled(userKey: string, enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const storageKey = resolveAssistantFloatingStorageKey(userKey)
    if (enabled) {
      window.localStorage.setItem(storageKey, '1')
    } else {
      window.localStorage.removeItem(storageKey)
    }
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }

  emitAssistantFloatingChange()
}

export function useAssistantFloatingEnabled(userKey: string) {
  return useSyncExternalStore(
    subscribeAssistantFloatingChange,
    () => getAssistantFloatingEnabled(userKey),
    () => false
  )
}

export function setAssistantFloatingBlockedByModal(id: string, blocked: boolean) {
  const isBlocked = blockedModalIds.has(id)
  if (blocked === isBlocked) {
    return
  }

  if (blocked) {
    blockedModalIds.add(id)
  } else {
    blockedModalIds.delete(id)
  }
  emitAssistantFloatingChange()
}

export function useAssistantFloatingBlockedByModal() {
  return useSyncExternalStore(
    subscribeAssistantFloatingChange,
    () => blockedModalIds.size > 0,
    () => false
  )
}
