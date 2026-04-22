import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

export const ACCESS_TOKEN_KEY = 'thisisjustarandomstring'
const AUTH_USER_KEY = 'app-auth-user'

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
    authList: string[]
    authRules: AuthRule[]
    setAuthList: (authList: string[]) => void
    setAuthRules: (authRules: AuthRule[]) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

export type AuthRule = {
  key: string
  path: string
  type?: number
  query?: Record<string, string>
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN_KEY)
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
            const raw = window.localStorage.getItem(AUTH_USER_KEY)
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
              window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
            } else {
              window.localStorage.removeItem(AUTH_USER_KEY)
            }
          }
          return { ...state, auth: { ...state.auth, user } }
        }),
      authList: [],
      authRules: [],
      setAuthList: (authList) =>
        set((state) => ({
          ...state,
          auth: {
            ...state.auth,
            authList: normalizeAuthList(authList),
          },
        })),
      setAuthRules: (authRules) =>
        set((state) => ({
          ...state,
          auth: {
            ...state.auth,
            authRules: normalizeAuthRules(authRules),
          },
        })),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(ACCESS_TOKEN_KEY, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN_KEY)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN_KEY)
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(AUTH_USER_KEY)
          }
          return {
            ...state,
            auth: { ...state.auth, user: null, authList: [], authRules: [], accessToken: '' },
          }
        }),
    },
  }
})

function normalizeAuthList(authList: string[]) {
  if (!Array.isArray(authList)) {
    return []
  }

  return Array.from(
    new Set(
      authList
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
    )
  )
}

function normalizeAuthRules(authRules: AuthRule[]) {
  if (!Array.isArray(authRules)) {
    return []
  }

  return authRules
    .map((rule) => ({
      key: String(rule?.key ?? '').trim(),
      path: normalizeAuthPath(rule?.path),
      type: Number(rule?.type || 0),
      query:
        rule?.query && typeof rule.query === 'object' && !Array.isArray(rule.query)
          ? Object.fromEntries(
              Object.entries(rule.query)
                .map(([key, value]) => [String(key).trim(), String(value).trim()])
                .filter(([key, value]) => key && value)
            )
          : undefined,
    }))
    .filter((rule) => rule.key && rule.path)
}

function normalizeAuthPath(path: unknown) {
  return String(path ?? '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
}
