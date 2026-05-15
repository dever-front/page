import { toast } from 'sonner'
import { parseRouterSearch } from '@/lib/router-search'
import type { FrontPermissionItem } from '@/lib/request'
import type { PageStore } from '@/lib/store'
import { buildAssistantPageContext, type AssistantPageContext } from './context'
import {
  findAssistantPage,
  subscribeAssistantRegistry,
  type AssistantPageRegistration,
} from './registry'

export type AssistantFrontAction =
  | {
      type: 'fill_form'
      target: string
      value: unknown
      summary?: string
    }
  | {
      type: 'patch_form'
      values: Record<string, unknown>
      summary?: string
    }
  | {
      type: 'open_page'
      path?: string
      permission_key?: string
      query?: Record<string, unknown>
      summary?: string
    }
  | {
      type: 'open_form'
      path?: string
      parent_path?: string
      permission_key?: string
      query?: Record<string, unknown>
      values?: Record<string, unknown>
      summary?: string
    }

export type AssistantActionParseResult = {
  cleanText: string
  actions: AssistantFrontAction[]
}

export type AssistantPermissionContext = {
  menu: unknown[]
  entry: string
  permissions: FrontPermissionItem[]
}

export type AssistantActionApplyOptions = {
  registration: AssistantPageRegistration | null
  context: AssistantPageContext | null
  permissionContext: AssistantPermissionContext | null
  navigate: (target: { to: string; search?: Record<string, unknown> }) => unknown
}

const FRONT_ACTION_PATTERN = /```front-action\s*([\s\S]*?)```/g
const OPEN_FORM_TIMEOUT_MS = 6000

export function extractAssistantFrontActions(text: string): AssistantActionParseResult {
  const actions: AssistantFrontAction[] = []
  const cleanText = String(text || '').replace(FRONT_ACTION_PATTERN, (_, raw) => {
    const action = parseAssistantFrontAction(raw)
    if (action) {
      actions.push(action)
    }
    return ''
  }).trim()

  return { cleanText, actions }
}

export async function applyAssistantFrontAction(
  options: AssistantActionApplyOptions,
  action: AssistantFrontAction
) {
  if (action.type === 'open_page') {
    return await applyOpenPageAction(options, action)
  }

  if (action.type === 'open_form') {
    return await applyOpenFormAction(options, action)
  }

  if (!options.registration) {
    toast.error('未识别到当前页面。')
    return false
  }

  return await applyFormAction(options.registration, options.context, action)
}

async function applyFormAction(
  registration: AssistantPageRegistration,
  context: AssistantPageContext | null,
  action: Extract<AssistantFrontAction, { type: 'fill_form' | 'patch_form' }>
) {
  const allowedPaths = new Set(
    context?.form?.fields.map((field) => normalizeAssistantActionPath(field.path)) ?? []
  )

  if (action.type === 'fill_form') {
    const target = normalizeAssistantActionPath(action.target)
    if (!isAllowedFormPath(target, allowedPaths)) {
      toast.error('AI 返回的字段不在当前表单中。')
      return false
    }
    await applyAssistantFormValues(registration, { [target]: action.value })
    toast.success(action.summary || '已填入字段')
    return true
  }

  const values: Record<string, unknown> = {}
  let applied = 0
  for (const [path, value] of Object.entries(action.values || {})) {
    const target = normalizeAssistantActionPath(path)
    if (!isAllowedFormPath(target, allowedPaths)) {
      continue
    }
    values[target] = value
    applied++
  }

  if (applied === 0) {
    toast.error('AI 返回的字段不在当前表单中。')
    return false
  }
  await applyAssistantFormValues(registration, values)
  toast.success(action.summary || `已填入 ${applied} 个字段`)
  return true
}

async function applyAssistantFormValues(
  registration: AssistantPageRegistration,
  values: Record<string, unknown>
) {
  if (registration.applyFormValues) {
    await registration.applyFormValues(values)
    return
  }

  for (const [path, value] of Object.entries(values)) {
    registration.store.getState().setValueByPath(path, value)
  }
}

export function assistantActionSummary(action: AssistantFrontAction) {
  if (action.summary) {
    return action.summary
  }
  if (action.type === 'fill_form') {
    return `填入 ${action.target}`
  }
  if (action.type === 'open_page') {
    return `打开 ${action.path || action.permission_key || '页面'}`
  }
  if (action.type === 'open_form') {
    return `打开 ${action.path || action.permission_key || '表单'}`
  }
  return `填入 ${Object.keys(action.values || {}).length} 个字段`
}

export function assistantActionPreview(action: AssistantFrontAction) {
  if (action.type === 'fill_form') {
    return previewValue(action.value)
  }
  if (action.type === 'open_page') {
    return [
      `路径: ${action.path || '-'}`,
      `权限: ${action.permission_key || '-'}`,
      action.query ? `参数: ${previewValue(action.query)}` : '',
    ].filter(Boolean).join('\n')
  }
  if (action.type === 'open_form') {
    return [
      `表单: ${action.path || '-'}`,
      `入口: ${action.parent_path || '-'}`,
      `权限: ${action.permission_key || '-'}`,
      action.values ? `填入:\n${previewValue(action.values)}` : '',
    ].filter(Boolean).join('\n')
  }
  return Object.entries(action.values || {})
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${previewValue(value)}`)
    .join('\n')
}

function parseAssistantFrontAction(raw: string): AssistantFrontAction | null {
  try {
    const parsed = JSON.parse(String(raw || '').trim())
    return normalizeAssistantFrontAction(parsed)
  } catch {
    return null
  }
}

function normalizeAssistantFrontAction(value: unknown): AssistantFrontAction | null {
  if (!isPlainObject(value)) {
    return null
  }
  const type = String(value.type || '').trim()
  if (type === 'fill_form') {
    const target = normalizeAssistantActionPath(String(value.target || ''))
    if (!target) {
      return null
    }
    return {
      type,
      target,
      value: value.value,
      summary: String(value.summary || '').trim() || undefined,
    }
  }
  if (type === 'patch_form' && isPlainObject(value.values)) {
    return {
      type,
      values: value.values,
      summary: String(value.summary || '').trim() || undefined,
    }
  }
  if (type === 'open_page') {
    const path = normalizeRoutePath(firstText(value.path, value.route, value.to))
    const permissionKey = firstText(value.permission_key, value.permissionKey, value.key)
    if (!path && !permissionKey) {
      return null
    }
    return {
      type,
      path: path || undefined,
      permission_key: permissionKey || undefined,
      query: normalizeActionQuery(value.query ?? value.search),
      summary: String(value.summary || '').trim() || undefined,
    }
  }
  if (type === 'open_form') {
    const path = normalizeRoutePath(
      firstText(value.path, value.route, value.form_path, value.formPath)
    )
    const parentPath = normalizeRoutePath(
      firstText(value.parent_path, value.parentPath, value.list_path, value.listPath)
    )
    const permissionKey = firstText(value.permission_key, value.permissionKey, value.key)
    if (!path && !permissionKey) {
      return null
    }
    return {
      type,
      path: path || undefined,
      parent_path: parentPath || undefined,
      permission_key: permissionKey || undefined,
      query: normalizeActionQuery(value.query ?? value.search),
      values: isPlainObject(value.values) ? value.values : undefined,
      summary: String(value.summary || '').trim() || undefined,
    }
  }
  return null
}

async function applyOpenPageAction(
  options: AssistantActionApplyOptions,
  action: Extract<AssistantFrontAction, { type: 'open_page' }>
) {
  const permission = findPermission(options.permissionContext, action)
  const route = resolveActionRoute(action, permission)
  if (
    !route ||
    !canUsePermissionRoute(options.permissionContext, permission, route, action)
  ) {
    toast.error('AI 返回的页面不在当前权限范围内。')
    return false
  }

  await navigateToRoute(options.navigate, route, action.query)
  toast.success(action.summary || '已打开页面')
  return true
}

async function applyOpenFormAction(
  options: AssistantActionApplyOptions,
  action: Extract<AssistantFrontAction, { type: 'open_form' }>
) {
  const permission = findPermission(options.permissionContext, action)
  const formRoute = normalizeRoutePath(action.path || permission?.path || '')
  if (
    !formRoute ||
    !canUsePermissionRoute(options.permissionContext, permission, formRoute, action)
  ) {
    toast.error('AI 返回的表单不在当前权限范围内。')
    return false
  }

  const parentRoute = resolveOpenFormParentRoute(
    options.permissionContext,
    action,
    permission,
    formRoute
  )
  if (!parentRoute || !canUseRoute(options.permissionContext, parentRoute)) {
    toast.error('没有找到可打开该表单的入口页面。')
    return false
  }

  await navigateToRoute(options.navigate, parentRoute)
  const parentRegistration = await waitForAssistantPage(
    (registration) => sameRoutePath(registration.route, parentRoute),
    OPEN_FORM_TIMEOUT_MS
  )
  if (!parentRegistration) {
    toast.error('入口页面尚未加载完成。')
    return false
  }

  const overlay = findOverlayForRoute(parentRegistration.store, formRoute, permission)
  if (!overlay?.stateKey) {
    toast.error('没有找到可打开该表单的弹窗。')
    return false
  }

  parentRegistration.store.getState().setPageState(overlay.stateKey, true)

  const formRegistration = await waitForAssistantPage(
    (registration) => sameRoutePath(registration.route, formRoute),
    OPEN_FORM_TIMEOUT_MS
  )
  if (!formRegistration) {
    toast.success(action.summary || '已打开表单')
    return true
  }

  if (action.values && Object.keys(action.values).length > 0) {
    const formContext = await waitForFormContext(formRegistration, OPEN_FORM_TIMEOUT_MS)
    if (formContext?.form?.fields.length) {
      return await applyFormAction(formRegistration, formContext, {
        type: 'patch_form',
        values: action.values,
        summary: action.summary || '已打开表单并填入内容',
      })
    }
  }

  toast.success(action.summary || '已打开表单')
  return true
}

function resolveActionRoute(
  action: { path?: string; permission_key?: string },
  permission: FrontPermissionItem | null
) {
  return normalizeRoutePath(action.path || permission?.path || '')
}

function findPermission(
  permissionContext: AssistantPermissionContext | null,
  action: { path?: string; permission_key?: string }
) {
  const permissions = permissionContext?.permissions ?? []
  const permissionKey = String(action.permission_key || '').trim()
  if (permissionKey) {
    return permissions.find((item) => item.key === permissionKey) ?? null
  }

  const route = normalizeRoutePath(action.path || '')
  if (!route) {
    return null
  }
  return permissions.find((item) => normalizeRoutePath(item.path || '') === route) ?? null
}

function canUsePermissionRoute(
  permissionContext: AssistantPermissionContext | null,
  permission: FrontPermissionItem | null,
  route: string,
  action: { permission_key?: string }
) {
  const normalizedRoute = normalizeRoutePath(route)
  if (!normalizedRoute) {
    return false
  }

  if (String(action.permission_key || '').trim()) {
    const permissionRoute = normalizeRoutePath(permission?.path || '')
    return permissionRoute ? permissionRoute === normalizedRoute : false
  }

  return canUseRoute(permissionContext, normalizedRoute)
}

function canUseRoute(permissionContext: AssistantPermissionContext | null, route: string) {
  const normalized = normalizeRoutePath(route)
  if (!normalized) {
    return false
  }
  return (permissionContext?.permissions ?? []).some(
    (item) => normalizeRoutePath(item.path || '') === normalized
  )
}

function resolveOpenFormParentRoute(
  permissionContext: AssistantPermissionContext | null,
  action: Extract<AssistantFrontAction, { type: 'open_form' }>,
  permission: FrontPermissionItem | null,
  formRoute: string
) {
  const explicitParent = normalizeRoutePath(action.parent_path || '')
  if (explicitParent) {
    return explicitParent
  }

  const parentKey = String(permission?.parent_key || '').trim()
  if (parentKey) {
    const parent = (permissionContext?.permissions ?? []).find(
      (item) => item.key === parentKey
    )
    if (parent?.path) {
      return normalizeRoutePath(parent.path)
    }
  }

  return listRouteFromFormRoute(formRoute)
}

function listRouteFromFormRoute(route: string) {
  const parts = normalizeRoutePath(route).split('/').filter(Boolean)
  if (parts.length < 2) {
    return ''
  }
  const last = parts[parts.length - 1]
  if (['create', 'edit', 'update', 'view', 'detail', 'info'].includes(last)) {
    parts[parts.length - 1] = 'list'
    return parts.join('/')
  }
  return ''
}

function findOverlayForRoute(
  store: PageStore,
  formRoute: string,
  permission: FrontPermissionItem | null
) {
  const items = Object.values(store.getState().schema.nodes ?? {}).flat()
  const candidates = items
    .map((item) => {
      const meta = item.meta ?? {}
      const route = normalizeRoutePath(String(meta.pageRoute || ''))
      if (!route || route !== normalizeRoutePath(formRoute)) {
        return null
      }
      const stateKey = String(meta.stateKey || item.id || '').trim()
      return stateKey ? { item, stateKey } : null
    })
    .filter((item): item is { item: any; stateKey: string } => item != null)

  if (candidates.length <= 1) {
    return candidates[0] ?? null
  }

  const intent = permissionIntent(permission)
  if (intent === 'create') {
    return (
      candidates.find((candidate) => /create|add|new/i.test(candidate.stateKey)) ||
      candidates.find((candidate) => !hasOverlayIDQuery(candidate.item)) ||
      candidates[0]
    )
  }
  if (intent === 'update') {
    return (
      candidates.find((candidate) => /edit|update/i.test(candidate.stateKey)) ||
      candidates.find((candidate) => hasOverlayIDQuery(candidate.item)) ||
      candidates[0]
    )
  }
  return candidates[0]
}

function permissionIntent(permission: FrontPermissionItem | null) {
  const idRule = String(permission?.query?.id || '').trim().toLowerCase()
  if (['empty', 'blank'].includes(idRule)) {
    return 'create'
  }
  if (['required', 'notempty', 'not_empty'].includes(idRule)) {
    return 'update'
  }
  const key = String(permission?.key || '').toLowerCase()
  if (key.endsWith('/create') || key.endsWith('/add')) {
    return 'create'
  }
  if (key.endsWith('/update') || key.endsWith('/edit')) {
    return 'update'
  }
  return ''
}

function hasOverlayIDQuery(item: any) {
  const query = item?.meta?.pageRouteQuery
  return !!query && typeof query === 'object' && !Array.isArray(query) && 'id' in query
}

async function navigateToRoute(
  navigate: AssistantActionApplyOptions['navigate'],
  route: string,
  query?: Record<string, unknown>
) {
  const target = routeToNavigationTarget(route, query)
  await navigate(target)
}

function routeToNavigationTarget(route: string, query?: Record<string, unknown>) {
  const [path, search = ''] = toAppPath(route).split('?')
  return {
    to: path || '/',
    search: {
      ...parseRouterSearch(search),
      ...(query ?? {}),
    },
  }
}

function toAppPath(route: string) {
  const normalized = String(route || '').trim()
  if (!normalized) {
    return '/'
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function waitForAssistantPage(
  match: (registration: AssistantPageRegistration) => boolean,
  timeoutMs: number
) {
  return new Promise<AssistantPageRegistration | null>((resolve) => {
    let done = false
    let unsubscribe = () => {}
    const finish = (registration: AssistantPageRegistration | null) => {
      if (done) {
        return
      }
      done = true
      window.clearTimeout(timer)
      unsubscribe()
      resolve(registration)
    }
    const check = () => {
      const registration = findAssistantPage(match)
      if (registration) {
        finish(registration)
      }
    }
    const timer = window.setTimeout(() => finish(null), timeoutMs)
    unsubscribe = subscribeAssistantRegistry(check)
    check()
  })
}

async function waitForFormContext(
  registration: AssistantPageRegistration,
  timeoutMs: number
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const context = buildAssistantPageContext(registration)
    if (context?.form?.fields.length) {
      return context
    }
    await sleep(100)
  }
  return null
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isAllowedFormPath(path: string, allowedPaths: Set<string>) {
  return path.startsWith('form.') && allowedPaths.has(path)
}

export function normalizeAssistantActionPath(path: string) {
  return String(path || '')
    .trim()
    .replace(/^data\.form\./, 'form.')
    .replace(/^data\./, '')
}

function normalizeRoutePath(path: string) {
  return String(path || '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
}

function sameRoutePath(left: string, right: string) {
  return normalizeRoutePath(left) === normalizeRoutePath(right)
}

function normalizeActionQuery(value: unknown) {
  return isPlainObject(value) ? value : undefined
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) {
      return text
    }
  }
  return ''
}

function previewValue(value: unknown) {
  const text =
    typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 2) ?? String(value ?? '')
  return text.length > 600 ? `${text.slice(0, 600)}...` : text
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
