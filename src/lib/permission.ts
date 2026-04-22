import { useAuthStore, type AuthRule } from '@/stores/auth-store'

export function useHasAuth(auth: unknown) {
  const authList = useAuthStore((state) => state.auth.authList)
  return hasAuth(auth, authList)
}

export function hasAuth(auth: unknown, authList: string[]) {
  const required = normalizeRequiredAuth(auth)
  if (required.length === 0) {
    return true
  }

  const allowed = new Set(
    authList.map((item) => String(item ?? '').trim()).filter(Boolean)
  )
  if (allowed.has('*')) {
    return true
  }

  return required.some((key) => allowed.has(key))
}

export function canAccessAuthKey(
  key: string,
  authList: string[],
  authRules: AuthRule[]
) {
  const normalizedKey = String(key ?? '').trim()
  if (!normalizedKey) {
    return true
  }

  if (!authRules.some((rule) => rule.key === normalizedKey)) {
    return true
  }

  return hasAuth(normalizedKey, authList)
}

export function canAccessRoute(
  route: string,
  query: Record<string, unknown> | undefined,
  authList: string[],
  authRules: AuthRule[]
) {
  const path = normalizeAuthPath(route)
  if (!path) {
    return true
  }

  const rules = authRules.filter((rule) => normalizeAuthPath(rule.path) === path)
  if (rules.length === 0) {
    return true
  }

  const matchedRule =
    rules.find((rule) => hasQueryRules(rule.query) && matchesAuthQuery(rule.query, query)) ??
    rules.find((rule) => matchesAuthQuery(rule.query, query))
  if (!matchedRule) {
    return false
  }

  return hasAuth(matchedRule.key, authList)
}

function normalizeRequiredAuth(auth: unknown) {
  if (Array.isArray(auth)) {
    return auth
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
  }

  const single = String(auth ?? '').trim()
  return single ? [single] : []
}

function matchesAuthQuery(
  rules: Record<string, string> | undefined,
  query: Record<string, unknown> | undefined
) {
  const entries = Object.entries(rules ?? {})
  if (entries.length === 0) {
    return true
  }

  for (const [key, rule] of entries) {
    const value = String(query?.[key] ?? '').trim()
    const empty = isEmptyAuthQueryValue(key, value)
    switch (String(rule || '').trim().toLowerCase()) {
      case 'required':
      case 'notempty':
      case 'not_empty':
        if (empty) {
          return false
        }
        break
      case 'empty':
        if (!empty) {
          return false
        }
        break
      default:
        if (value !== String(rule ?? '').trim()) {
          return false
        }
    }
  }

  return true
}

function isEmptyAuthQueryValue(key: string, value: string) {
  if (!value) {
    return true
  }

  if (isAuthIDQueryKey(key)) {
    const numberValue = Number(value)
    return Number.isFinite(numberValue) && numberValue <= 0
  }

  return false
}

function isAuthIDQueryKey(key: string) {
  const normalized = String(key || '').trim().toLowerCase()
  return normalized === 'id' || normalized.endsWith('.id') || normalized.endsWith('_id')
}

function hasQueryRules(rules: Record<string, string> | undefined) {
  return Object.keys(rules ?? {}).length > 0
}

export function normalizeAuthPath(path: unknown) {
  return String(path ?? '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
}
