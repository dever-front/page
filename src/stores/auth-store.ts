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
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
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
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})
