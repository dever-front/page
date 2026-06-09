import { getRuntimeConfig } from '@/config/app-config'
import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

interface AuthUser {
  id: number
  name: string
  account: string
  role: string[]
  exp: number
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(getAccessTokenKey())
  const initToken = (() => {
    if (!cookieState) {
      return ''
    }
    try {
      return JSON.parse(cookieState)
    } catch {
      return cookieState
    }
  })()
  const initUser =
    typeof window !== 'undefined'
      ? (() => {
          try {
            const raw = window.localStorage.getItem(getAuthUserKey())
            return raw ? JSON.parse(raw) : null
          } catch {
            return null
          }
        })()
      : null
  return {
    auth: {
      user: initUser,
      setUser: (user) =>
        set((state) => {
          if (typeof window !== 'undefined') {
            if (user) {
              window.localStorage.setItem(
                getAuthUserKey(),
                JSON.stringify(user)
              )
            } else {
              window.localStorage.removeItem(getAuthUserKey())
            }
          }
          return { ...state, auth: { ...state.auth, user } }
        }),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(getAccessTokenKey(), JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(getAccessTokenKey())
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(getAccessTokenKey())
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(getAuthUserKey())
          }
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})

export function getAccessTokenKey() {
  return `front-token:${currentAuthStorageScope()}`
}

export function getAuthUserKey() {
  return `front-user:${currentAuthStorageScope()}`
}

function currentAuthStorageScope() {
  return `${normalizeStorageKeyPart(currentSiteKey())}_${currentHostKey()}`
}

function currentSiteKey() {
  return String(getRuntimeConfig().siteKey || 'admin').trim() || 'admin'
}

function currentHostKey() {
  const runtime = getRuntimeConfig()
  const host =
    browserHost() || String(runtime.siteHost || runtime.host || '').trim()
  return normalizeStorageKeyPart(host || 'default')
}

function browserHost() {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.location.host || window.location.hostname || ''
}

function normalizeStorageKeyPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'default'
}
