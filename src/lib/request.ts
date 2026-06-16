/**
 * request.ts - 统一请求封装
 * 支持 get/post，统一错误处理
 */
import { getRuntimeConfig } from '@/config/app-config'
import { getAccessTokenKey, useAuthStore } from '@/stores/auth-store'
import { getCookie } from '@/lib/cookies'
import { resetPageProgressCache } from '@/lib/page-progress'
import {
  getCurrentRouterHref,
  getCurrentRouterPathname,
  getRouterBasePath,
  stripRouterBasePath,
} from '@/lib/router-path'

export type RequestResult = {
  code: number
  data: any
  message?: string
}

export const REQUEST_ERROR_EVENT = 'app:request-error'
export const FRONT_RUNTIME_REFRESH_EVENT = 'app:front-runtime-refresh'
export const SITE_CONTEXT_HEADER = 'X-Dever-Site'
const AUTH_REQUIRED_CODE = 401

export type RequestErrorDetail = {
  code?: number
  message: string
}

export type MainInfoResult = {
  menu: any[]
  entry: string
}

export type MainBootstrapResult = {
  main: MainInfoResult
  path: string
  schema: any | null
}

export type FrontPermissionItem = {
  id?: number
  key: string
  name: string
  icon?: string
  path?: string
  parent_id?: number
  parent_key?: string
  type?: number
  sort?: number
  query?: Record<string, string>
}

export type AssistantPermissionContextResult = MainInfoResult & {
  permissions: FrontPermissionItem[]
}

export type FrontRuntimeRefreshDetail = {
  reason: 'main-sync' | 'manual'
}

type BackendResponseError = Error & {
  backendResponse?: any
  httpStatus?: number
}

let mainInfoPromise: Promise<MainInfoResult> | null = null
let mainInfoCacheToken = ''
let mainBootstrapPromise: Promise<MainBootstrapResult> | null = null
let mainBootstrapCacheToken = ''
let assistantPermissionPromise: Promise<AssistantPermissionContextResult> | null =
  null
let assistantPermissionCacheToken = ''
let authRedirecting = false
const remoteSchemaPromiseCache = new Map<string, Promise<any>>()
const remoteSchemaValueCache = new Map<
  string,
  { data: any; expiresAt: number }
>()
let remoteSchemaCacheVersion = 0
const REMOTE_SCHEMA_VALUE_CACHE_TTL = 1000

type BatchResult = {
  code?: number
  message?: string
  msg?: string
  data?: any
  path?: string
}

type OptionBatchPending = {
  url: string
  params: Record<string, string>
  resolve: (value: RequestResult) => void
}

let optionBatchScheduled = false
const optionBatchQueue: OptionBatchPending[] = []

function normalizeRequestMethod(method: string = 'get') {
  return method.toLowerCase()
}

function emitRequestError(detail: RequestErrorDetail) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<RequestErrorDetail>(REQUEST_ERROR_EVENT, { detail })
  )
}

function isAuthRequiredResult(result?: RequestResult | null) {
  return Number(result?.code ?? 0) === AUTH_REQUIRED_CODE
}

function handleAuthRequiredResult(result?: RequestResult | null) {
  if (!isAuthRequiredResult(result) || typeof window === 'undefined') {
    return false
  }

  useAuthStore.getState().auth.reset()
  clearFrontRuntimeCache()
  redirectToSignIn()
  return true
}

function redirectToSignIn() {
  if (authRedirecting) {
    return
  }

  const currentPath = getCurrentRouterPathname()
  if (currentPath === '/sign-in') {
    return
  }

  authRedirecting = true
  const signInPath = `${getRouterBasePath()}/sign-in`
  const redirect = encodeURIComponent(getCurrentRouterHref() || '/')
  window.location.assign(`${signInPath}?redirect=${redirect}`)
}

function emitFrontRuntimeRefresh(detail: FrontRuntimeRefreshDetail) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<FrontRuntimeRefreshDetail>(FRONT_RUNTIME_REFRESH_EVENT, {
      detail,
    })
  )
}

export function joinFrontApi(path: string) {
  const { host } = getRuntimeConfig()
  if (!host) return ''
  return `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export function joinSiteApi(path: string) {
  const { siteHost, host } = getRuntimeConfig()
  const base = siteHost || host
  if (!base) return ''
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function resolveRuntimeOrigin() {
  const { host } = getRuntimeConfig()
  const normalizedHost = String(host || '').trim()
  if (!normalizedHost) {
    return ''
  }
  if (normalizedHost.startsWith('/')) {
    return ''
  }

  try {
    return new URL(normalizedHost).origin
  } catch {
    return normalizedHost.replace(/\/front\/?$/, '').replace(/\/+$/, '')
  }
}

export function resolveRequestUrl(api: string) {
  if (/^https?:\/\//i.test(api)) {
    return api
  }

  if (api.startsWith('/front/')) {
    return joinFrontApi(api.replace(/^\/front\/+/, ''))
  }

  if (api.startsWith('/upload/')) {
    return resolveAssetUrl(api)
  }

  if (api.startsWith('/')) {
    const devProxyUrl = resolveDevBackendProxyUrl(api)
    if (devProxyUrl) {
      return devProxyUrl
    }

    const origin = resolveRuntimeOrigin()
    return origin ? `${origin}${api}` : api
  }

  return api
}

function resolveDevBackendProxyUrl(api: string) {
  if (!import.meta.env.DEV) {
    return ''
  }

  const normalizedApi = String(api || '').trim()
  if (
    !normalizedApi.startsWith('/') ||
    normalizedApi.startsWith('/__dever_api/')
  ) {
    return ''
  }

  const { host } = getRuntimeConfig()
  if (!String(host || '').startsWith('/__dever_api/')) {
    return ''
  }

  return `/__dever_api${normalizedApi}`
}

export function resolveAssetUrl(url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) {
    return ''
  }

  if (
    /^https?:\/\//i.test(normalizedUrl) ||
    normalizedUrl.startsWith('blob:') ||
    normalizedUrl.startsWith('data:')
  ) {
    return normalizedUrl
  }

  if (normalizedUrl.startsWith('/front/')) {
    return resolveRequestUrl(normalizedUrl)
  }

  if (normalizedUrl.startsWith('/upload/')) {
    const origin = resolveRuntimeOrigin()
    if (!origin) {
      return normalizedUrl
    }
    return `${origin}${normalizedUrl}`
  }

  return normalizedUrl
}

function applyAccessTokenHeader(headers: Record<string, string>) {
  const accessToken = getCookie(getAccessTokenKey())
  if (!accessToken) {
    return headers
  }

  try {
    const parsedToken = JSON.parse(accessToken)
    if (parsedToken) {
      headers.Authorization = `Bearer ${parsedToken}`
      return headers
    }
  } catch {
    // ignore parse error and fallback to raw cookie value
  }

  headers.Authorization = `Bearer ${accessToken}`
  return headers
}

function applyClientPageHeader(headers: Record<string, string>) {
  if (typeof window === 'undefined') {
    return headers
  }

  const clientPage = getCurrentRouterHref().trim()
  if (!clientPage) {
    return headers
  }

  headers['X-Client-Page'] = clientPage
  return headers
}

function applySiteContextHeader(headers: Record<string, string>) {
  const siteKey = String(getRuntimeConfig().siteKey || '').trim()
  if (siteKey) {
    headers[SITE_CONTEXT_HEADER] = siteKey
  }
  return headers
}

export function buildRuntimeRequestHeaders(options?: {
  accept?: string
  contentType?: string | false
}) {
  const headers: Record<string, string> = {}
  const contentType = options?.contentType ?? 'application/json'
  if (contentType !== false) {
    headers['Content-Type'] = contentType
  }
  if (options?.accept) {
    headers.Accept = options.accept
  }
  applyAccessTokenHeader(headers)
  applyClientPageHeader(headers)
  applySiteContextHeader(headers)
  return headers
}

function appendQueryString(url: string, params?: any) {
  if (!params || typeof params !== 'object') {
    return url
  }

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      searchParams.set(key, String(value))
    }
  }

  const qs = searchParams.toString()
  if (!qs) {
    return url
  }
  return `${url}${url.includes('?') ? '&' : '?'}${qs}`
}

function normalizeRoute(route: string) {
  const normalizedRoute = String(route || '').trim()
  const pathValue = normalizedRoute.startsWith('/')
    ? stripRouterBasePath(normalizedRoute)
    : normalizedRoute
  return pathValue.replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
}

/**
 * 发起原始请求，返回后端原始 JSON。
 * 适合业务自己消费非 CRUD 标准结构，例如 Energon 流式帧。
 */
export async function requestRaw(
  api: string,
  method: string = 'get',
  params?: any
): Promise<any> {
  const normalizedMethod = normalizeRequestMethod(method)
  const fetchMethod = normalizedMethod.toUpperCase()
  const isGetMethod = normalizedMethod === 'get'
  const isFormData =
    typeof FormData !== 'undefined' && params instanceof FormData
  const headers = buildRuntimeRequestHeaders({
    contentType: isFormData ? false : 'application/json',
  })
  const options: RequestInit = {
    method: fetchMethod,
    headers,
  }

  let url = resolveRequestUrl(api)

  if (isGetMethod && params && !isFormData) {
    url = appendQueryString(url, params)
  } else if (params) {
    options.body = isFormData ? params : JSON.stringify(params)
  }

  const response = await fetch(url, options)
  const rawText = await response.text()
  const result = rawText ? parseResponseBody(rawText) : null
  if (!response.ok) {
    if (isBackendResponseEnvelope(result)) {
      throw createBackendResponseError(result, response.status)
    }
    const message =
      result && typeof result === 'object'
        ? String(result.msg ?? result.message ?? `请求失败(${response.status})`)
        : `请求失败(${response.status})`
    throw createBackendResponseError(
      { status: 2, code: response.status, data: null, msg: message },
      response.status
    )
  }
  return result
}

/**
 * 发起请求
 * 统一走真实 HTTP 请求
 */
export async function request(
  api: string,
  method: string = 'get',
  params?: any
): Promise<RequestResult> {
  try {
    const normalizedMethod = normalizeRequestMethod(method)
    if (isBatchableRouteOptionRequest(api, normalizedMethod, params)) {
      return await queueRouteOptionRequest(api, params)
    }

    const result = await requestRaw(api, method, params)
    const normalized = normalizeRequestRawPayload(result)
    if (handleAuthRequiredResult(normalized)) {
      return normalized
    }
    applyRuntimeRequestSideEffects(api, normalizedMethod, normalized)
    return normalized
  } catch (error) {
    console.error('[request] 请求失败:', api, error)

    if (isBackendResponseError(error)) {
      const normalized = normalizeBackendResponse(
        error.backendResponse,
        error.httpStatus
      )
      if (handleAuthRequiredResult(normalized)) {
        return normalized
      }
      if (normalized.message) {
        emitRequestError({
          code: normalized.code,
          message: normalized.message,
        })
      }
      applyRuntimeRequestSideEffects(
        api,
        normalizeRequestMethod(method),
        normalized
      )
      return normalized
    }

    const message =
      error instanceof Error && error.message ? error.message : '请求失败'
    emitRequestError({ code: -1, message })
    return { code: -1, data: null, message }
  }
}

function normalizeRequestRawPayload(result: any): RequestResult {
  if (
    result &&
    typeof result === 'object' &&
    'status' in result &&
    'data' in result
  ) {
    const normalized = normalizeBackendResponse(result)

    if (
      Number(result.status) === 2 &&
      normalized.message &&
      !isAuthRequiredResult(normalized)
    ) {
      emitRequestError({
        code: normalized.code,
        message: normalized.message,
      })
    }

    return normalized
  }

  if (isRuntimeResponseFrame(result)) {
    return normalizeRuntimeResponseFrame(result)
  }

  return result as RequestResult
}

function normalizeBackendResponse(
  result: any,
  httpStatus?: number
): RequestResult {
  return {
    code:
      Number(result?.status) === 1
        ? 0
        : Number(result?.code ?? httpStatus ?? -1),
    data: result?.data,
    message: String(result?.msg ?? result?.message ?? ''),
  }
}

function createBackendResponseError(result: any, httpStatus: number) {
  const message = String(
    result?.msg ?? result?.message ?? `请求失败(${httpStatus})`
  )
  const error = new Error(message) as BackendResponseError
  error.backendResponse = result
  error.httpStatus = httpStatus
  return error
}

function isBackendResponseError(error: unknown): error is BackendResponseError {
  return (
    error instanceof Error && !!(error as BackendResponseError).backendResponse
  )
}

function isBackendResponseEnvelope(value: unknown) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('status' in value ||
      'code' in value ||
      'msg' in value ||
      'message' in value)
  )
}

function isRuntimeResponseFrame(value: unknown) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'status' in value &&
    ('content' in value ||
      ('request_id' in value && 'type' in value && 'output' in value))
  )
}

function normalizeRuntimeResponseFrame(result: any): RequestResult {
  const normalized: RequestResult = {
    code: Number(result.status) === 1 ? 0 : Number(result.code ?? -1),
    data: result,
    message: String(result.msg ?? result.message ?? ''),
  }

  if (Number(result.status) === 2 && normalized.message) {
    if (!isAuthRequiredResult(normalized)) {
      emitRequestError({
        code: normalized.code,
        message: normalized.message,
      })
    }
  }

  return normalized
}

function parseResponseBody(rawText: string) {
  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}

export async function requestBlob(
  api: string,
  method: string = 'get',
  params?: any
): Promise<Blob | null> {
  try {
    const normalizedMethod = normalizeRequestMethod(method)
    const isGetMethod = normalizedMethod === 'get'
    const isFormData =
      typeof FormData !== 'undefined' && params instanceof FormData
    const headers: Record<string, string> = {}
    applyAccessTokenHeader(headers)
    applyClientPageHeader(headers)
    applySiteContextHeader(headers)
    const options: RequestInit = {
      method: normalizedMethod.toUpperCase(),
      headers,
    }

    let url = resolveRequestUrl(api)
    if (isGetMethod && params && !isFormData) {
      url = appendQueryString(url, params)
    } else if (params) {
      options.body = isFormData ? params : JSON.stringify(params)
      if (!isFormData) {
        headers['Content-Type'] = 'application/json'
      }
    }

    const response = await fetch(url, options)
    if (!response.ok) {
      emitRequestError({
        code: response.status,
        message: `请求失败(${response.status})`,
      })
      return null
    }
    return await response.blob()
  } catch (error) {
    console.error('[requestBlob] 请求失败:', api, error)
    return null
  }
}

/**
 * 加载页面 Schema JSON
 * 根据 route 路径从后端加载页面 JSON
 */
export async function loadPageSchema(
  route: string,
  options: { skipValueCache?: boolean } = {}
): Promise<any> {
  try {
    const [routePath, routeQuery = ''] = route.split('?')
    const normalizedRoute = normalizeRoute(routePath)
    const queryString = new URLSearchParams(routeQuery).toString()
    const cacheKey = schemaCacheKey(normalizedRoute, queryString)

    if (!normalizedRoute) {
      return null
    }

    if (!options.skipValueCache) {
      const cachedSchema = remoteSchemaValueCache.get(cacheKey)
      if (cachedSchema && cachedSchema.expiresAt > Date.now()) {
        return cachedSchema.data
      }
      if (cachedSchema) {
        remoteSchemaValueCache.delete(cacheKey)
      }
    }

    if (!options.skipValueCache) {
      const pending = remoteSchemaPromiseCache.get(cacheKey)
      if (pending) {
        return await pending
      }
    }

    const routeApi = joinFrontApi('route/info')
    if (!routeApi) {
      return null
    }

    const extraParams = Object.fromEntries(
      new URLSearchParams(routeQuery).entries()
    )

    const cacheVersion = remoteSchemaCacheVersion
    const schemaPromise = loadPageSchemaSingle(
      routeApi,
      normalizedRoute,
      extraParams
    )

    remoteSchemaPromiseCache.set(cacheKey, schemaPromise)

    try {
      const schema = await schemaPromise
      if (
        schema &&
        cacheVersion === remoteSchemaCacheVersion &&
        remoteSchemaPromiseCache.get(cacheKey) === schemaPromise
      ) {
        cachePageSchema(normalizedRoute, queryString, schema)
      }
      return schema
    } finally {
      if (remoteSchemaPromiseCache.get(cacheKey) === schemaPromise) {
        remoteSchemaPromiseCache.delete(cacheKey)
      }
    }
  } catch (error) {
    console.error('[loadPageSchema] 加载失败:', route, error)
    return null
  }
}

async function loadPageSchemaSingle(
  routeApi: string,
  normalizedRoute: string,
  extraParams: Record<string, string>
) {
  const result = await request(routeApi, 'get', {
    path: normalizedRoute,
    ...extraParams,
  })
  if (Number(result?.code ?? 0) !== 0) {
    return null
  }

  return normalizeSchemaPayload(result)
}

function normalizeSchemaPayload(result: RequestResult) {
  const payload =
    result?.data && typeof result.data === 'object' && 'page' in result.data
      ? result.data
      : result

  return payload && typeof payload === 'object' && 'page' in payload
    ? payload
    : null
}

function cachePageSchema(
  normalizedRoute: string,
  queryString: string,
  schema: any
) {
  if (!normalizedRoute || !schema) {
    return
  }
  remoteSchemaValueCache.set(schemaCacheKey(normalizedRoute, queryString), {
    data: schema,
    expiresAt: Date.now() + REMOTE_SCHEMA_VALUE_CACHE_TTL,
  })
}

export function clearRemotePageSchemaCache() {
  remoteSchemaCacheVersion += 1
  remoteSchemaPromiseCache.clear()
  remoteSchemaValueCache.clear()
}

function schemaCacheKey(normalizedRoute: string, queryString = '') {
  const routeCacheKey = queryString
    ? `${normalizedRoute}?${queryString}`
    : normalizedRoute
  return `${getRuntimeSchemaCachePrefix()}:${routeCacheKey}`
}

function isBatchableRouteOptionRequest(
  api: string,
  method: string,
  params?: any
) {
  if (typeof window === 'undefined') {
    return false
  }
  if (method !== 'get') {
    return false
  }
  if (typeof FormData !== 'undefined' && params instanceof FormData) {
    return false
  }

  const routeOptionPath = runtimeApiPath('route/option')
  if (!routeOptionPath) {
    return false
  }
  try {
    const url = new URL(
      resolveGETRequestUrl(api, params),
      window.location.origin
    )
    return (
      normalizePathname(url.pathname) === normalizePathname(routeOptionPath)
    )
  } catch {
    return false
  }
}

function queueRouteOptionRequest(
  api: string,
  params?: any
): Promise<RequestResult> {
  const url = resolveGETRequestUrl(api, params)
  return new Promise((resolve) => {
    const parsedURL = new URL(url, window.location.origin)
    optionBatchQueue.push({
      url,
      params: Object.fromEntries(parsedURL.searchParams.entries()),
      resolve,
    })
    if (optionBatchScheduled) {
      return
    }
    optionBatchScheduled = true
    Promise.resolve().then(flushRouteOptionBatch)
  })
}

async function flushRouteOptionBatch() {
  const pending = optionBatchQueue.splice(0)
  optionBatchScheduled = false
  if (pending.length === 0) {
    return
  }
  if (pending.length === 1) {
    await fallbackRouteOptionRequests(pending)
    return
  }

  const batchApi = joinFrontApi('route/batch_option')
  if (!batchApi) {
    await fallbackRouteOptionRequests(pending)
    return
  }

  try {
    const raw = await requestRaw(batchApi, 'post', {
      options: pending.map((item) => item.params),
    })
    const results = normalizeBatchResults(raw)
    pending.forEach((item, index) => {
      item.resolve(normalizeBatchResult(results[index]))
    })
  } catch {
    await fallbackRouteOptionRequests(pending)
  }
}

async function fallbackRouteOptionRequests(pending: OptionBatchPending[]) {
  await Promise.all(
    pending.map(async (item) => {
      try {
        item.resolve(normalizeRequestRawPayload(await requestRaw(item.url)))
      } catch (error) {
        item.resolve({
          code: -1,
          data: null,
          message:
            error instanceof Error && error.message
              ? error.message
              : '请求失败',
        })
      }
    })
  )
}

function normalizeBatchResult(result?: BatchResult): RequestResult {
  const code = Number(result?.code ?? -1)
  const message = String(result?.message ?? result?.msg ?? '')
  const normalized = {
    code,
    data: result?.data ?? null,
    message,
  }
  if (handleAuthRequiredResult(normalized)) {
    return normalized
  }
  if (code !== 0 && message) {
    emitRequestError({ code, message })
  }
  return normalized
}

function normalizeBatchResults(raw: any): BatchResult[] {
  if (Array.isArray(raw?.data)) {
    return raw.data as BatchResult[]
  }
  return Array.isArray(raw) ? (raw as BatchResult[]) : []
}

function resolveGETRequestUrl(api: string, params?: any) {
  return appendQueryString(resolveRequestUrl(api), params)
}

function runtimeApiPath(path: string) {
  const api = joinFrontApi(path)
  if (!api) {
    return ''
  }
  try {
    return new URL(api, window.location.origin).pathname
  } catch {
    return api.split('?')[0]
  }
}

export async function loadMainInfo(): Promise<MainInfoResult> {
  const cacheToken = getMainInfoCacheToken()
  if (!mainInfoPromise || mainInfoCacheToken !== cacheToken) {
    mainInfoCacheToken = cacheToken
    mainInfoPromise = (async () => {
      const menuApi = joinFrontApi('main/info')
      if (!menuApi) {
        return { menu: [], entry: '' }
      }

      const result = await request(menuApi)
      return {
        menu: Array.isArray(result.data?.menu) ? result.data.menu : [],
        entry: typeof result.data?.entry === 'string' ? result.data.entry : '',
      }
    })()
  }

  return mainInfoPromise
}

export async function loadMainBootstrap(
  mainRoute: string
): Promise<MainBootstrapResult> {
  const normalizedMainRoute = normalizeRoute(mainRoute)
  const cacheToken = [
    getMainInfoCacheToken(),
    getRuntimeSchemaCachePrefix(),
    normalizedMainRoute,
  ].join(':')

  if (!mainBootstrapPromise || mainBootstrapCacheToken !== cacheToken) {
    mainBootstrapCacheToken = cacheToken
    mainBootstrapPromise = (async () => {
      const bootstrapApi = joinFrontApi('main/bootstrap')
      if (!bootstrapApi) {
        return loadMainBootstrapFallback(normalizedMainRoute)
      }

      const result = await request(bootstrapApi)
      if (Number(result?.code ?? -1) !== 0) {
        return loadMainBootstrapFallback(normalizedMainRoute)
      }

      const main = normalizeMainInfoPayload(result.data?.main)
      const schema = normalizeSchemaPayload({
        code: 0,
        data: result.data?.schema,
      })
      const schemaPath = normalizeRoute(
        result.data?.path || normalizedMainRoute
      )
      primeMainInfoCache(main)
      if (schema) {
        cachePageSchema(schemaPath, '', schema)
        if (schemaPath !== normalizedMainRoute) {
          cachePageSchema(normalizedMainRoute, '', schema)
        }
      }

      return {
        main,
        path: schemaPath,
        schema,
      }
    })()
  }

  return mainBootstrapPromise
}

async function loadMainBootstrapFallback(
  normalizedMainRoute: string
): Promise<MainBootstrapResult> {
  const [main, schema] = await Promise.all([
    loadMainInfo(),
    loadPageSchema(normalizedMainRoute),
  ])
  return {
    main,
    path: normalizedMainRoute,
    schema,
  }
}

function normalizeMainInfoPayload(value: unknown): MainInfoResult {
  const payload =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  return {
    menu: Array.isArray(payload.menu) ? payload.menu : [],
    entry: typeof payload.entry === 'string' ? payload.entry : '',
  }
}

function primeMainInfoCache(main: MainInfoResult) {
  const cacheToken = getMainInfoCacheToken()
  mainInfoCacheToken = cacheToken
  mainInfoPromise = Promise.resolve(main)
}

export async function loadAssistantPermissionContext(): Promise<AssistantPermissionContextResult> {
  const cacheToken = getMainInfoCacheToken()
  if (
    !assistantPermissionPromise ||
    assistantPermissionCacheToken !== cacheToken
  ) {
    assistantPermissionCacheToken = cacheToken
    assistantPermissionPromise = (async () => {
      const result = await request(joinFrontApi('main/info'), 'get', {
        include: 'permissions',
      })
      return {
        menu: Array.isArray(result.data?.menu) ? result.data.menu : [],
        entry: typeof result.data?.entry === 'string' ? result.data.entry : '',
        permissions: normalizeFrontPermissions(result.data?.permissions),
      }
    })()
  }

  return assistantPermissionPromise
}

export function resetFrontRuntimeCache(notify = false) {
  clearFrontRuntimeCache()
  if (notify) {
    emitFrontRuntimeRefresh({ reason: 'manual' })
  }
}

function getMainInfoCacheToken() {
  return String(
    useAuthStore.getState().auth.accessToken ||
      getCookie(getAccessTokenKey()) ||
      ''
  )
}

function getRuntimeSchemaCachePrefix() {
  const runtime = getRuntimeConfig()
  return [
    String(runtime.siteKey || '').trim(),
    String(runtime.host || '').trim(),
  ].join(':')
}

export async function loadSidebarMenu() {
  const result = await loadMainInfo()
  return result.menu
}

function applyRuntimeRequestSideEffects(
  api: string,
  method: string,
  result: RequestResult
) {
  if (Number(result?.code ?? -1) !== 0 || !isMainInfoSyncRequest(api, method)) {
    return
  }

  clearFrontRuntimeCache()
  emitFrontRuntimeRefresh({ reason: 'main-sync' })
}

function clearFrontRuntimeCache() {
  mainInfoPromise = null
  mainInfoCacheToken = ''
  mainBootstrapPromise = null
  mainBootstrapCacheToken = ''
  assistantPermissionPromise = null
  assistantPermissionCacheToken = ''
  clearRemotePageSchemaCache()
  resetPageProgressCache()
}

function normalizeFrontPermissions(value: unknown): FrontPermissionItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeFrontPermission(item))
    .filter((item): item is FrontPermissionItem => item != null)
}

function normalizeFrontPermission(value: unknown): FrontPermissionItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const item = value as Record<string, unknown>
  const key = String(item.key ?? '').trim()
  const name = String(item.name ?? key).trim()
  if (!key && !name) {
    return null
  }

  const normalized: FrontPermissionItem = {
    key,
    name: name || key,
    icon: String(item.icon ?? '').trim() || undefined,
    path: String(item.path ?? '').trim() || undefined,
    parent_key:
      String(item.parent_key ?? item.parentKey ?? '').trim() || undefined,
    type: normalizeOptionalNumber(item.type),
    sort: normalizeOptionalNumber(item.sort),
  }
  const id = normalizeOptionalNumber(item.id)
  if (id !== undefined) {
    normalized.id = id
  }
  const parentID = normalizeOptionalNumber(item.parent_id ?? item.parentId)
  if (parentID !== undefined) {
    normalized.parent_id = parentID
  }
  const query = normalizePermissionQuery(item.query)
  if (query) {
    normalized.query = query
  }
  return normalized
}

function normalizePermissionQuery(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(
      ([key, current]) => [key.trim(), String(current ?? '').trim()] as const
    )
    .filter(([key, current]) => key !== '' && current !== '')
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function normalizeOptionalNumber(value: unknown) {
  if (value == null || value === '') {
    return undefined
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function isMainInfoSyncRequest(api: string, method: string) {
  if (normalizeRequestMethod(method) === 'get') {
    return false
  }

  return normalizeApiPath(api) === normalizeApiPath(joinFrontApi('main/sync'))
}

function normalizeApiPath(api: string) {
  const value = String(api || '').trim()
  if (!value) {
    return ''
  }

  try {
    const base =
      typeof window === 'undefined'
        ? 'http://localhost'
        : window.location.origin
    return normalizePathname(new URL(value, base).pathname)
  } catch {
    return normalizePathname(value.split('?')[0])
  }
}

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}
