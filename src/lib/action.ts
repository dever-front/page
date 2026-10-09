/**
 * action.ts - Action 执行器
 * 统一执行所有 action，所有 action 都必须从这里走
 * 支持动作类型：state / data / request / page / modal / save / delete / export / import / increment / array
 * 支持 action 数组串行执行和 then 链式执行
 */
import { createExportTask, readCurrentExportQuery } from './export-task'
import { getByPath, isScopedStorePath } from './path'
import { clearRemoteOptionCache } from './remote-option-cache'
import { clearRemotePageSchemaCache, joinFrontApi, request } from './request'
import {
  appendStoreRouteQueryParams,
  normalizeRoutePagePath,
} from './route-context'
import { buildInheritedPageRoute } from './route-inherit'
import type { ActionConfig } from './schema'
import type { PageStore } from './store'
import {
  acquireActionSubmission,
  actionSubmissionScopes,
  isMutatingRequestMethod,
  type SubmissionContext,
} from './action-submission'

type ActionContext = SubmissionContext
type ActionInvocation = string | ActionConfig

export type ActionRunResult = {
  success: boolean
  ignored?: boolean
  data?: any
  message?: string
}

export type ImportActionPayload = {
  kind: 'import'
  path: string
  importKey: string
  tableId?: string
  uploadRuleId?: number
  then?: string | string[]
}

/**
 * 按 action 名称执行
 */
export async function runAction(
  store: PageStore,
  actionName: string,
  context?: ActionContext
): Promise<void> {
  await runActionWithResult(store, actionName, context)
}

export async function runActionWithResult(
  store: PageStore,
  actionName: string,
  context?: ActionContext
): Promise<ActionRunResult> {
  const state = store.getState()
  const currentConfig = state.action[actionName]
  const config =
    currentConfig && !currentConfig.key
      ? { ...currentConfig, key: actionName }
      : currentConfig
  if (!config) {
    console.warn('[runAction] action 不存在:', actionName)
    return { success: false, message: `action 不存在: ${actionName}` }
  }
  return await runActionConfigWithResult(store, config, context)
}

/**
 * 直接执行 action 配置
 */
export async function runActionConfig(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<void> {
  await runActionConfigWithResult(store, config, context)
}

export async function runActionConfigWithResult(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<ActionRunResult> {
  return await withActionSubmission(store, config, context, execution =>
    executeActionConfig(store, config, execution)
  )
}

async function executeActionConfig(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<ActionRunResult> {
  const { type } = config

  switch (type) {
    case 'state':
      handleStateAction(store, config, context)
      return { success: true }
    case 'data':
      handleDataAction(store, config, context)
      return { success: true }
    case 'request':
      return await handleRequestAction(store, config, context)
    case 'page':
      handlePageAction(store, config, context)
      return { success: true }
    case 'modal':
      handleModalAction(store, config, context)
      return { success: true }
    case 'save':
      return await handleSaveAction(store, config, context)
    case 'delete':
      return await handleDeleteAction(store, config, context)
    case 'export':
      return await handleExportAction(store, config, context)
    case 'import':
      return await handleImportAction(store, config, context)
    case 'increment':
      handleIncrementAction(store, config)
      return { success: true }
    case 'array':
      handleArrayAction(store, config, context)
      return { success: true }
    default:
      console.warn('[runActionConfig] 未知 action 类型:', type)
      return {
        success: false,
        message: `未知 action 类型: ${String(type || '')}`,
      }
  }
}

/**
 * 执行 action 名称或名称数组
 * 用于节点的 action 映射（click: "do-something" 或 click: ["a", "b"]）
 */
export async function runActions(
  store: PageStore,
  nameOrNames: ActionInvocation | ActionInvocation[],
  context?: ActionContext
): Promise<void> {
  await runActionsWithResult(store, nameOrNames, context)
}

export async function runActionsWithResult(
  store: PageStore,
  nameOrNames: ActionInvocation | ActionInvocation[],
  context?: ActionContext
): Promise<ActionRunResult> {
  return await withActionSubmission(store, nameOrNames, context, execution =>
    executeActions(store, nameOrNames, execution)
  )
}

async function withActionSubmission(
  store: PageStore,
  actions: ActionInvocation | ActionInvocation[],
  context: ActionContext | undefined,
  perform: (execution: ActionContext) => Promise<ActionRunResult>
): Promise<ActionRunResult> {
  const submission = acquireActionSubmission(
    actionSubmissionScopes(store, actions, context),
    context
  )
  if (!submission) return { success: false, ignored: true }
  try {
    return await perform(submission.context)
  } finally {
    submission.release()
  }
}

async function executeActions(
  store: PageStore,
  nameOrNames: ActionInvocation | ActionInvocation[],
  context?: ActionContext
): Promise<ActionRunResult> {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames]
  let lastResult: ActionRunResult = { success: true }
  for (const action of names) {
    let result: ActionRunResult
    if (typeof action === 'string') {
      result = await runActionWithResult(store, action, context)
    } else {
      result = await runActionConfigWithResult(store, action, context)
    }

    if (!result.success) {
      return result
    }

    lastResult = result
  }

  return lastResult
}

// ========== 各类型处理器 ==========

/**
 * state: 修改 state
 */
function handleStateAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
) {
  if (config.key != null && config.value !== undefined) {
    store
      .getState()
      .setValueByPath(
        normalizeActionKeyPath('state', config.key),
        resolveContextValue(config.value, context)
      )
  }
}

/**
 * data: 修改 data
 */
function handleDataAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
) {
  if (config.key != null && config.value !== undefined) {
    store
      .getState()
      .setValueByPath(
        normalizeActionKeyPath('data', config.key),
        resolveContextValue(config.value, context)
      )
  }
}

/**
 * request: 调用接口并回写数据
 */
async function handleRequestAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<ActionRunResult> {
  if (!config.api) {
    console.warn('[handleRequestAction] 缺少 api')
    return { success: false, message: '缺少 api' }
  }

  // 读取参数
  let params: any = undefined
  if (config.params !== undefined) {
    if (typeof config.params === 'string') {
      if (config.params.startsWith('$')) {
        params = resolveContextValue(config.params, context)
      } else {
        params = store.getState().getValueByPath(config.params)
      }
    } else {
      params = resolveTemplateValue(config.params, context)
    }
  }

  // 发起请求
  const result = await request(config.api, config.method || 'get', params)

  if (result.code !== 0) {
    const fieldMessages = applyRequestFieldErrors(
      store,
      result.data?.fieldErrors
    )
    return {
      success: false,
      data: result.data,
      message: resolveActionErrorMessage(
        result.message,
        fieldMessages,
        '请求失败'
      ),
    }
  }

  if (isMutatingRequestMethod(config.method)) {
    clearMutationCaches()
  }

  // 写回目标
  if (config.target) {
    store.getState().setValueByPath(config.target, result.data)
  }

  // 执行 then 链
  if (config.then) {
    const thenResult = await runActionsWithResult(store, config.then, context)
    return thenResult.success
      ? {
          ...thenResult,
          data: thenResult.data ?? result.data,
          message: thenResult.message || result.message,
        }
      : thenResult
  }

  return {
    success: true,
    data: result.data,
    message: result.message,
  }
}

async function handleSaveAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<ActionRunResult> {
  const path = resolveActionPagePath(store, config)
  if (!path) {
    console.warn('[handleSaveAction] 缺少页面路径')
    return { success: false, message: '缺少页面路径' }
  }

  const payload = withRoutePrimaryKey(
    resolveActionPayload(store, config.params ?? 'form', context),
    store,
    config,
    path
  )
  return await submitCrudAction(store, config, path, payload, context)
}

async function handleDeleteAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<ActionRunResult> {
  const path = resolveActionPagePath(store, config)
  if (!path) {
    console.warn('[handleDeleteAction] 缺少页面路径')
    return { success: false, message: '缺少页面路径' }
  }

  const payload =
    config.params !== undefined
      ? resolveActionPayload(store, config.params, context)
      : undefined

  return await submitCrudAction(store, config, path, payload, context)
}

async function handleExportAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<ActionRunResult> {
  const pagePath = resolveExportPagePath(store, config, context)
  if (!pagePath) {
    return { success: false, message: '缺少页面路径' }
  }

  const exportKey = resolveExportKey(config, context)
  if (!exportKey) {
    return { success: false, message: '缺少导出项标识' }
  }

  try {
    const task = await createExportTask({
      path: pagePath,
      tableId: resolveExportTableID(config, context),
      exportKey,
      query: readCurrentExportQuery(),
    })

    if (config.then) {
      const thenResult = await runActionsWithResult(store, config.then, context)
      return thenResult.success
        ? {
            ...thenResult,
            data: thenResult.data ?? task,
            message: thenResult.message,
          }
        : thenResult
    }

    return { success: true, data: task }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || '创建导出任务失败',
    }
  }
}

async function handleImportAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
): Promise<ActionRunResult> {
  const pagePath = resolveExportPagePath(store, config, context)
  if (!pagePath) {
    return { success: false, message: '缺少页面路径' }
  }

  const importKey = resolveImportKey(config, context)
  if (!importKey) {
    return { success: false, message: '缺少导入项标识' }
  }

  return {
    success: true,
    data: {
      kind: 'import',
      path: pagePath,
      importKey,
      tableId: resolveExportTableID(config, context),
      uploadRuleId: Number(config.uploadRuleId || 0),
      then: config.then,
    },
  }
}

/**
 * page: 切换子页面（本质是修改 state/data 路径）
 */
function handlePageAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
) {
  if (config.target && config.value !== undefined) {
    store
      .getState()
      .setValueByPath(config.target, resolveContextValue(config.value, context))
  }
}

/**
 * modal: 控制弹窗状态（本质也是修改 state）
 */
function handleModalAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
) {
  if (config.key != null && config.value !== undefined) {
    store
      .getState()
      .setValueByPath(
        normalizeActionKeyPath('modal', config.key),
        resolveContextValue(config.value, context)
      )
  }
}

function handleIncrementAction(store: PageStore, config: ActionConfig) {
  const key = String(config.key || '').trim()
  if (!key) {
    return
  }

  const currentValue = Number(store.getState().getValueByPath(key) || 0)
  store
    .getState()
    .setValueByPath(key, Number.isFinite(currentValue) ? currentValue + 1 : 1)
}

function handleArrayAction(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
) {
  const key = String(config.key || '').trim()
  if (!key) {
    return
  }

  const rows = normalizeArrayActionRows(store.getState().getValueByPath(key))
  const op = String(config.op || 'append')
    .trim()
    .toLowerCase()
  const nextValue =
    config.value !== undefined
      ? resolveTemplateValue(config.value, context)
      : config.params !== undefined
        ? resolveActionPayload(store, config.params, context)
        : undefined
  const index = normalizeArrayActionIndex(
    resolveArrayActionIndex(store, config, context)
  )

  switch (op) {
    case 'append':
      rows.push(cloneActionValue(nextValue ?? {}))
      break
    case 'upsert':
      if (index >= 0 && index < rows.length) {
        rows[index] = cloneActionValue(nextValue ?? {})
      } else {
        rows.push(cloneActionValue(nextValue ?? {}))
      }
      break
    case 'patch':
      if (index >= 0 && index < rows.length) {
        rows[index] = mergeArrayActionPatch(rows[index], nextValue)
      }
      break
    case 'update':
      if (index >= 0 && index < rows.length) {
        rows[index] = cloneActionValue(nextValue ?? {})
      }
      break
    case 'remove':
    case 'delete':
      if (index >= 0 && index < rows.length) {
        rows.splice(index, 1)
      }
      break
    default:
      console.warn('[handleArrayAction] 未知数组操作:', op)
      return
  }

  store.getState().setValueByPath(key, rows)
}

function normalizeArrayActionRows(value: unknown) {
  return Array.isArray(value) ? value.map((row) => cloneActionValue(row)) : []
}

function resolveArrayActionIndex(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
) {
  if (config.index === undefined) {
    return context?.rowIndex
  }
  if (typeof config.index === 'string' && !config.index.startsWith('$')) {
    return store.getState().getValueByPath(config.index)
  }
  return resolveContextValue(config.index, context)
}

function mergeArrayActionPatch(row: unknown, patch: unknown) {
  const base =
    row && typeof row === 'object' && !Array.isArray(row)
      ? cloneActionValue(row as Record<string, any>)
      : {}
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return base
  }

  return {
    ...base,
    ...(patch as Record<string, any>),
  }
}

function normalizeArrayActionIndex(value: unknown) {
  if (value == null || value === '') {
    return -1
  }
  const index = Number(value)
  return Number.isInteger(index) ? index : -1
}

function cloneActionValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value
  }
  return structuredClone(value)
}

async function submitCrudAction(
  store: PageStore,
  config: ActionConfig,
  path: string,
  payload: any,
  context?: ActionContext
): Promise<ActionRunResult> {
  const actionKey = resolveCrudRequestKey(config, context)
  const result = await request(
    joinFrontApi(resolveCrudActionRoute(store, config, path)),
    'post',
    {
      key: actionKey,
      payload,
    }
  )

  if (result.code !== 0) {
    const fieldMessages = applyRequestFieldErrors(
      store,
      result.data?.fieldErrors
    )
    return {
      success: false,
      data: result.data,
      message: resolveActionErrorMessage(
        result.message,
        fieldMessages,
        '操作失败'
      ),
    }
  }

  clearMutationCaches()

  if (config.target) {
    store.getState().setValueByPath(config.target, result.data)
  }

  if (config.then) {
    const thenResult = await runActionsWithResult(store, config.then, context)
    return thenResult.success
      ? {
          ...thenResult,
          data: thenResult.data ?? result.data,
          message: thenResult.message || result.message,
        }
      : thenResult
  }

  return {
    success: true,
    data: result.data,
    message: result.message,
  }
}

function resolveCrudActionRoute(
  store: PageStore,
  config: ActionConfig,
  path: string
) {
  const params = new URLSearchParams()
  params.set('path', normalizeRoutePagePath(path))
  if (shouldInheritCrudRouteQuery(store, config, path)) {
    appendStoreRouteQueryParams(params, store)
  } else {
    appendInheritedCrudRouteParams(params, store, config, path)
  }

  return `route/action?${params.toString()}`
}

function appendInheritedCrudRouteParams(
  params: URLSearchParams,
  store: PageStore,
  config: ActionConfig,
  path: string
) {
  if (config.inheritRouteQuery === false) {
    return
  }

  const inheritedRoute = buildInheritedPageRoute(path, store)
  const queryIndex = inheritedRoute.indexOf('?')
  if (queryIndex < 0) {
    return
  }

  const inheritedParams = new URLSearchParams(
    inheritedRoute.slice(queryIndex + 1)
  )
  for (const [key, value] of inheritedParams.entries()) {
    if (!params.has(key)) {
      params.append(key, value)
    }
  }
}

function shouldInheritCrudRouteQuery(
  store: PageStore,
  config: ActionConfig,
  actionPath: string
) {
  if (config.inheritRouteQuery !== undefined) {
    return config.inheritRouteQuery
  }

  return isCurrentPageActionPath(store, actionPath)
}

function resolveCrudRequestKey(
  config: ActionConfig,
  context?: ActionContext
) {
  const configKey = normalizeOperationKey(String(config.key || '').trim())
  if (configKey) {
    return configKey
  }

  switch (
    String(config.type || '')
      .trim()
      .toLowerCase()
  ) {
    case 'delete':
      return (
        normalizeOperationKey(
          String(
            context?.itemKey ||
              context?.item?.key ||
              context?.item?.id ||
              ''
          ).trim()
        ) || 'delete'
      )
    case 'save':
      return 'submit'
    default:
      return normalizeOperationKey(String(context?.itemKey || '').trim())
  }
}

function normalizeOperationKey(key: string) {
  return String(key || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
}

// ========== 辅助函数 ==========

function resolveContextValue(value: any, context?: ActionContext) {
  if (typeof value === 'string' && value.startsWith('$')) {
    const path = value.slice(1)
    const [root, ...rest] = path.split('.')
    const rootValue = context?.[root]

    if (rest.length === 0) {
      return rootValue
    }

    return getByPath(rootValue, rest.join('.'))
  }

  return value
}

function resolveTemplateValue(value: any, context?: ActionContext): any {
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, context))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveTemplateValue(item, context),
      ])
    )
  }

  return resolveContextValue(value, context)
}

function resolveActionPayload(
  store: PageStore,
  source: any,
  context?: ActionContext
) {
  if (typeof source === 'string') {
    if (source.startsWith('$')) {
      return resolveContextValue(source, context)
    }

    return store.getState().getValueByPath(source)
  }

  return resolveTemplateValue(source, context)
}

function withRoutePrimaryKey(
  payload: any,
  store: PageStore,
  config: ActionConfig,
  savePath: string
) {
  if (!isPlainActionObject(payload)) {
    return payload
  }
  if (!isCurrentPageActionPath(store, savePath)) {
    return payload
  }

  const primaryKey = String(config.pk || 'id').trim() || 'id'
  if (hasPrimaryKeyValue(payload[primaryKey], primaryKey)) {
    return payload
  }

  const routeID = readRoutePrimaryKeyValue(store, primaryKey)
  if (!hasPrimaryKeyValue(routeID, primaryKey)) {
    return payload
  }

  return {
    ...payload,
    [primaryKey]: routeID,
  }
}

function isCurrentPageActionPath(store: PageStore, actionPath: string) {
  const normalizedActionPath = normalizeActionPagePath(actionPath)
  const currentPath = normalizeActionPagePath(store.getState().pagePath)
  if (currentPath && currentPath === normalizedActionPath) {
    return true
  }

  const schemaPath = normalizeActionPagePath(
    String(store.getState().schema.page?.route ?? '')
  )
  return !!schemaPath && schemaPath === normalizedActionPath
}

function readRoutePrimaryKeyValue(store: PageStore, primaryKey: string) {
  const query = store.getState().state?.route?.query
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return undefined
  }

  const value = (query as Record<string, unknown>)[primaryKey]
  const primaryValue = firstPrimaryKeyValue(value, primaryKey)
  if (primaryValue !== undefined) {
    return primaryValue
  }

  if (primaryKey !== 'id') {
    return firstPrimaryKeyValue((query as Record<string, unknown>).id, 'id')
  }

  return undefined
}

function firstPrimaryKeyValue(value: unknown, primaryKey: string): unknown {
  if (!Array.isArray(value)) {
    return hasPrimaryKeyValue(value, primaryKey) ? value : undefined
  }

  return value.find((item) => hasPrimaryKeyValue(item, primaryKey))
}

function isPlainActionObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasActionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.some(hasActionValue)
  }
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function hasPrimaryKeyValue(value: unknown, primaryKey: string) {
  if (Array.isArray(value)) {
    return value.some((item) => hasPrimaryKeyValue(item, primaryKey))
  }
  if (!hasActionValue(value)) {
    return false
  }

  const text = String(value).trim()
  if (isNumericPrimaryKey(primaryKey)) {
    return /^[1-9]\d*$/.test(text)
  }

  return true
}

function isNumericPrimaryKey(primaryKey: string) {
  const key = String(primaryKey || '').trim().toLowerCase()
  return key === 'id' || key.endsWith('_id')
}

function clearMutationCaches() {
  clearRemoteOptionCache()
  clearRemotePageSchemaCache()
}

function resolveExportPagePath(
  store: PageStore,
  config: ActionConfig,
  context?: ActionContext
) {
  const configPath = String(
    resolveContextValue(config.path, context) || ''
  ).trim()
  if (configPath) {
    return configPath
  }

  const pagePath = String(store.getState().pagePath || '').trim()
  if (pagePath) {
    return pagePath
  }

  return String(store.getState().schema.page?.route || '').trim()
}

function resolveExportKey(config: ActionConfig, context?: ActionContext) {
  const configuredKey = String(config.exportKey || '').trim()
  if (configuredKey) {
    return configuredKey
  }

  const actionKey = String(config.key || '').trim()
  if (actionKey) {
    return actionKey
  }

  const contextKey = String(context?.itemKey || '').trim()
  if (contextKey) {
    return contextKey
  }

  const item = context?.item as Record<string, any> | undefined
  return String(item?.key || item?.id || '').trim()
}

function resolveImportKey(config: ActionConfig, context?: ActionContext) {
  const configuredKey = String(config.importKey || '').trim()
  if (configuredKey) {
    return configuredKey
  }

  const actionKey = String(config.key || '').trim()
  if (actionKey) {
    return actionKey
  }

  const contextKey = String(context?.itemKey || '').trim()
  if (contextKey) {
    return contextKey
  }

  const item = context?.item as Record<string, any> | undefined
  return String(item?.key || item?.id || '').trim()
}

function resolveExportTableID(config: ActionConfig, context?: ActionContext) {
  const configuredTableID = String(config.tableId || '').trim()
  if (configuredTableID) {
    return configuredTableID
  }

  const item = context?.item as Record<string, any> | undefined
  if (item?.meta?.tableId) {
    return String(item.meta.tableId).trim()
  }

  const group = context?.group as Record<string, any> | undefined
  return String(group?.meta?.tableId || '').trim()
}

function normalizeActionKeyPath(type: 'state' | 'data' | 'modal', key: string) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) {
    return ''
  }

  if (isScopedStorePath(normalizedKey)) {
    return normalizedKey
  }

  return type === 'data' ? `data.${normalizedKey}` : `state.${normalizedKey}`
}

function resolveActionPagePath(store: PageStore, config: ActionConfig) {
  const configPath = normalizeActionPagePath(config.path)
  if (configPath) {
    return configPath
  }

  const storePath = normalizeActionPagePath(store.getState().pagePath)
  if (storePath) {
    return storePath
  }

  return normalizeActionPagePath(
    String(store.getState().schema.page?.route ?? '')
  )
}

function normalizeActionPagePath(path: string | undefined) {
  return normalizeRoutePagePath(path)
}

function applyRequestFieldErrors(store: PageStore, fieldErrors: unknown) {
  if (
    !fieldErrors ||
    typeof fieldErrors !== 'object' ||
    Array.isArray(fieldErrors)
  ) {
    return []
  }

  const items = Object.values(store.getState().schema.nodes ?? {}).flat()
  const pathToItemId = new Map<string, string>()

  for (const item of items) {
    if (item.id && item.value) {
      for (const path of fieldPathCandidates(item.value)) {
        pathToItemId.set(path, item.id)
      }
    }
  }

  const messages: string[] = []
  for (const [path, message] of Object.entries(
    fieldErrors as Record<string, unknown>
  )) {
    const normalizedMessage = String(message ?? '').trim()
    if (!normalizedMessage) {
      continue
    }
    messages.push(normalizedMessage)

    const itemId = firstMatchedFieldItemID(pathToItemId, path)
    if (itemId) {
      store.getState().setError(itemId, normalizedMessage)
    }
  }

  return messages
}

function firstMatchedFieldItemID(
  pathToItemId: Map<string, string>,
  path: string
) {
  for (const candidate of fieldPathCandidates(path)) {
    const itemId = pathToItemId.get(candidate)
    if (itemId) {
      return itemId
    }
  }
  return ''
}

function fieldPathCandidates(path: unknown) {
  const normalized = String(path || '').trim()
  if (!normalized) {
    return []
  }

  const candidates = new Set<string>([normalized])
  if (normalized.startsWith('data.')) {
    candidates.add(normalized.slice(5))
  } else {
    candidates.add(`data.${normalized}`)
  }
  if (normalized.startsWith('state.')) {
    candidates.add(normalized.slice(6))
  } else {
    candidates.add(`state.${normalized}`)
  }

  return Array.from(candidates)
}

function resolveActionErrorMessage(
  message: unknown,
  fieldMessages: string[],
  fallback: string
) {
  const normalizedMessage = String(message ?? '').trim()
  if (normalizedMessage) {
    return normalizedMessage
  }
  return fieldMessages.find((current) => current.trim() !== '') || fallback
}
