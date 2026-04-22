import { getByPath } from '@/lib/path'
import {
  canAccessAuthKey,
  canAccessRoute,
  hasAuth,
  normalizeAuthPath,
} from '@/lib/permission'
import type { PageStore, PageStoreState } from '@/lib/store'
import { useAuthStore, type AuthRule } from '@/stores/auth-store'

type ActionContext = Record<string, any>
type RouteTarget = {
  route: string
  query?: Record<string, unknown>
}

type InferenceContext = ActionContext & {
  patches?: Record<string, unknown>
}

export function useCanUseItem(
  store: PageStore,
  item: Record<string, any>,
  context?: ActionContext
) {
  const authList = useAuthStore((state) => state.auth.authList)
  const authRules = useAuthStore((state) => state.auth.authRules)
  return canUseItem(store.getState(), item, context, authList, authRules)
}

export function canUseItem(
  state: PageStoreState,
  item: Record<string, any>,
  context: ActionContext | undefined,
  authList: string[],
  authRules: AuthRule[]
) {
  if (!hasAuth(item?.auth, authList)) {
    return false
  }

  const decision = inferItemPermission(state, item, context ?? {})
  if (!decision) {
    return true
  }

  if (decision.kind === 'route') {
    return canAccessRoute(decision.target.route, decision.target.query, authList, authRules)
  }

  return canAccessAuthKey(decision.key, authList, authRules)
}

function inferItemPermission(
  state: PageStoreState,
  item: Record<string, any>,
  context: ActionContext
): { kind: 'route'; target: RouteTarget } | { kind: 'key'; key: string } | null {
  const directRoute = inferDirectRouteTarget(state, item, context)
  if (directRoute) {
    return { kind: 'route', target: directRoute }
  }

  const clickAction = item?.action?.click
  if (clickAction) {
    return inferActionPermission(state, clickAction, item, context)
  }

  return null
}

function inferActionPermission(
  state: PageStoreState,
  rawAction: unknown,
  owner: Record<string, any>,
  context: ActionContext
): { kind: 'route'; target: RouteTarget } | { kind: 'key'; key: string } | null {
  const actions = Array.isArray(rawAction) ? rawAction : [rawAction]
  const patches: Record<string, unknown> = {}

  for (const action of actions) {
    const currentContext: InferenceContext = { ...context, patches }

    if (typeof action === 'string') {
      const namedAction = state.action[action]
      if (!namedAction) {
        continue
      }
      const result = inferActionConfigPermission(state, namedAction, owner, {
        ...currentContext,
        itemKey: currentContext.itemKey ?? action,
      })
      if (result) {
        return result
      }
      continue
    }

    if (!isPlainObject(action)) {
      continue
    }

    if (collectDataPatch(action, currentContext, patches)) {
      continue
    }

    const result = inferActionConfigPermission(state, action, owner, currentContext)
    if (result) {
      return result
    }
  }

  return null
}

function inferActionConfigPermission(
  state: PageStoreState,
  action: Record<string, any>,
  owner: Record<string, any>,
  context: InferenceContext
): { kind: 'route'; target: RouteTarget } | { kind: 'key'; key: string } | null {
  const type = String(action.type || '').trim().toLowerCase()
  switch (type) {
    case 'modal':
      return inferOverlayPermission(state, String(action.key || '').trim(), context)
    case 'export':
      return inferActionKeyPermission(state, resolveActionItemKey(action, owner, context, 'exportKey'))
    case 'import':
      return inferActionKeyPermission(state, resolveActionItemKey(action, owner, context, 'importKey'))
    case 'delete':
      return inferActionKeyPermission(state, resolveActionItemKey(action, owner, context, 'key'))
    default:
      return null
  }
}

function inferOverlayPermission(
  state: PageStoreState,
  stateKey: string,
  context: InferenceContext
): { kind: 'route'; target: RouteTarget } | { kind: 'key'; key: string } | null {
  if (!stateKey) {
    return null
  }

  const overlay = findOverlayByStateKey(state, stateKey)
  if (!overlay) {
    return null
  }

  const route = buildOverlayRouteTarget(state, overlay, context)
  if (route) {
    return { kind: 'route', target: route }
  }

  const confirmAction = overlay.action?.confirm
  if (confirmAction) {
    return inferActionPermission(state, confirmAction, overlay, {
      ...context,
      itemKey: context.itemKey ?? normalizeOperationKey(stateKey),
    })
  }

  return null
}

function inferActionKeyPermission(state: PageStoreState, actionKey: string) {
  const key = normalizeOperationKey(actionKey)
  if (!key) {
    return null
  }

  const pagePath = normalizeAuthPath(state.pagePath || state.schema.page?.route || '')
  if (!pagePath) {
    return null
  }

  return { kind: 'key' as const, key: `${pagePath}/${key}` }
}

function inferDirectRouteTarget(
  state: PageStoreState,
  item: Record<string, any>,
  context: ActionContext
): RouteTarget | null {
  const route = String(item?.to || item?.meta?.to || '').trim()
  if (!route) {
    return null
  }

  const target = parseRouteTarget(route)
  const searchParam = String(item?.searchParam || item?.meta?.searchParam || '').trim()
  if (searchParam) {
    const searchField = String(item?.searchField || item?.meta?.searchField || '').trim()
    const value = searchField ? getByPath(context.row, searchField) : context.row?.id
    if (value != null && String(value).trim() !== '') {
      target.query = {
        ...(target.query ?? {}),
        [searchParam]: value,
      }
    }
  }

  return target
}

function buildOverlayRouteTarget(
  state: PageStoreState,
  overlay: Record<string, any>,
  context: InferenceContext
): RouteTarget | null {
  const route = String(
    overlay.meta?.pageRoute ||
      (overlay.meta?.pageRoutePath ? resolveValue(state, overlay.meta.pageRoutePath, context) : '') ||
      ''
  ).trim()
  if (!route) {
    return null
  }

  const target = parseRouteTarget(route)
  const routeQuery = isPlainObject(overlay.meta?.pageRouteQuery)
    ? overlay.meta.pageRouteQuery
    : {}

  for (const [key, value] of Object.entries(routeQuery)) {
    const resolved = resolveValue(state, value, context)
    if (resolved == null || String(resolved).trim() === '') {
      continue
    }
    target.query = {
      ...(target.query ?? {}),
      [key]: resolved,
    }
  }

  return target
}

function findOverlayByStateKey(state: PageStoreState, stateKey: string) {
  for (const items of Object.values(state.schema.nodes ?? {})) {
    for (const item of items) {
      const currentKey = String(item.meta?.stateKey || item.id || '').trim()
      if (currentKey === stateKey) {
        return item
      }
    }
  }
  return null
}

function collectDataPatch(
  action: Record<string, any>,
  context: InferenceContext,
  patches: Record<string, unknown>
) {
  const type = String(action.type || '').trim().toLowerCase()
  if (type !== 'data' && type !== 'state') {
    return false
  }

  const key = String(action.key || '').trim()
  if (!key) {
    return true
  }

  const resolved = resolveValueFromContext(action.value, context)
  patches[key] = resolved
  patches[`${type}.${key}`] = resolved
  return true
}

function resolveActionItemKey(
  action: Record<string, any>,
  owner: Record<string, any>,
  context: InferenceContext,
  configKey: string
) {
  return String(
    action[configKey] ||
      context.itemKey ||
      context.item?.key ||
      context.item?.id ||
      owner?.key ||
      owner?.id ||
      ''
  ).trim()
}

function resolveValue(state: PageStoreState, value: unknown, context: InferenceContext): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (Object.prototype.hasOwnProperty.call(context.patches ?? {}, value)) {
    return context.patches?.[value]
  }

  const fromContext = resolveValueFromContext(value, context)
  if (fromContext !== undefined) {
    return fromContext
  }

  if (value.startsWith('data.') || value.startsWith('state.')) {
    return state.getValueByPath(value)
  }

  return value
}

function resolveValueFromContext(value: unknown, context: InferenceContext): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (value.startsWith('$row.')) {
    return getByPath(context.row, value.slice('$row.'.length))
  }
  if (value === '$row') {
    return context.row
  }

  return undefined
}

function parseRouteTarget(route: string): RouteTarget {
  const [path, rawQuery = ''] = String(route || '').split('?')
  const query = Object.fromEntries(new URLSearchParams(rawQuery).entries())
  return {
    route: path,
    query: Object.keys(query).length > 0 ? query : undefined,
  }
}

function normalizeOperationKey(key: string) {
  return String(key || '').trim().replace(/^\/+|\/+$/g, '').replace(/\./g, '-')
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
