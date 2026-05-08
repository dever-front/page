/**
 * request.ts - 统一请求封装
 * 支持 get/post，统一错误处理
 */
import { getRuntimeConfig } from '@/config/app-config'
import { getCookie } from '@/lib/cookies'
import { resetPageProgressCache } from '@/lib/page-progress'
import { ACCESS_TOKEN_KEY, useAuthStore } from '@/stores/auth-store'

export type RequestResult = {
  code: number
  data: any
  message?: string
}

export const REQUEST_ERROR_EVENT = 'app:request-error'
export const FRONT_RUNTIME_REFRESH_EVENT = 'app:front-runtime-refresh'

export type RequestErrorDetail = {
  code?: number
  message: string
}

export type MainInfoResult = {
  menu: any[]
  entry: string
  auth: string[]
  authRules: any[]
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
const remoteSchemaPromiseCache = new Map<string, Promise<any>>()
const remoteSchemaValueCache = new Map<string, { data: any; expiresAt: number }>()
const REMOTE_SCHEMA_VALUE_CACHE_TTL = 1000

function normalizeRequestMethod(method: string = 'get') {
  return method.toLowerCase()
}

function emitRequestError(detail: RequestErrorDetail) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<RequestErrorDetail>(REQUEST_ERROR_EVENT, { detail }))
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

function joinFrontApi(path: string) {
  const { host } = getRuntimeConfig()
  if (!host) return ''
  return `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function resolveRuntimeOrigin() {
  const { host } = getRuntimeConfig()
  const normalizedHost = String(host || '').trim()
  if (!normalizedHost) {
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
    const origin = resolveRuntimeOrigin()
    return origin ? `${origin}${api}` : api
  }

  return api
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
  const accessToken = getCookie(ACCESS_TOKEN_KEY)
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

  const clientPage = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`.trim()
  if (!clientPage) {
    return headers
  }

  headers['X-Client-Page'] = clientPage
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
  return route.replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
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
  const headers: Record<string, string> = {}
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  applyAccessTokenHeader(headers)
  applyClientPageHeader(headers)
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
    throw new Error(message)
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
    const result = await requestRaw(api, method, params)

    if (
      result &&
      typeof result === 'object' &&
      'status' in result &&
      'data' in result
    ) {
      const normalized = normalizeBackendResponse(result)

      if (
        Number(result.status) === 2 &&
        normalized.message
      ) {
        emitRequestError({
          code: normalized.code,
          message: normalized.message,
        })
      }

      applyRuntimeRequestSideEffects(api, normalizedMethod, normalized)
      return normalized
    }

    if (
      result &&
      typeof result === 'object' &&
      'status' in result &&
      'content' in result
    ) {
      const normalized: RequestResult = {
        code: result.status === 1 ? 0 : Number(result.code ?? -1),
        data: result,
        message: String(result.msg ?? result.message ?? ''),
      }

      if (Number(result.status) === 2 && normalized.message) {
        emitRequestError({
          code: normalized.code,
          message: normalized.message,
        })
      }

      applyRuntimeRequestSideEffects(api, normalizedMethod, normalized)
      return normalized
    }

    const normalized = result as RequestResult
    applyRuntimeRequestSideEffects(api, normalizedMethod, normalized)
    return normalized
  } catch (error) {
    console.error('[request] 请求失败:', api, error)

    if (isBackendResponseError(error)) {
      const normalized = normalizeBackendResponse(
        error.backendResponse,
        error.httpStatus
      )
      if (normalized.message) {
        emitRequestError({
          code: normalized.code,
          message: normalized.message,
        })
      }
      applyRuntimeRequestSideEffects(api, normalizeRequestMethod(method), normalized)
      return normalized
    }

    const message = error instanceof Error && error.message ? error.message : '请求失败'
    emitRequestError({ code: -1, message })
    return { code: -1, data: null, message }
  }
}

function normalizeBackendResponse(result: any, httpStatus?: number): RequestResult {
  return {
    code: Number(result?.status) === 1 ? 0 : Number(result?.code ?? httpStatus ?? -1),
    data: result?.data,
    message: String(result?.msg ?? result?.message ?? ''),
  }
}

function createBackendResponseError(result: any, httpStatus: number) {
  const message = String(result?.msg ?? result?.message ?? `请求失败(${httpStatus})`)
  const error = new Error(message) as BackendResponseError
  error.backendResponse = result
  error.httpStatus = httpStatus
  return error
}

function isBackendResponseError(error: unknown): error is BackendResponseError {
  return (
    error instanceof Error &&
    !!(error as BackendResponseError).backendResponse
  )
}

function isBackendResponseEnvelope(value: unknown) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('status' in value || 'code' in value || 'msg' in value || 'message' in value)
  )
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
    const cacheKey = queryString ? `${normalizedRoute}?${queryString}` : normalizedRoute

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

    const pending = remoteSchemaPromiseCache.get(cacheKey)
    if (pending) {
      return await pending
    }

    const routeApi = joinFrontApi('route/info')
    if (!routeApi) {
      return null
    }

    const extraParams = Object.fromEntries(new URLSearchParams(routeQuery).entries())

    const schemaPromise = (async () => {
      const result = await request(routeApi, 'get', {
        path: normalizedRoute,
        ...extraParams,
      })
      if (Number(result?.code ?? 0) !== 0) {
        return null
      }

      const payload =
        result?.data && typeof result.data === 'object' && 'page' in result.data
          ? result.data
          : result

      return payload && typeof payload === 'object' && 'page' in payload ? payload : null
    })()

    remoteSchemaPromiseCache.set(cacheKey, schemaPromise)

    try {
      const schema = await schemaPromise
      if (schema) {
        remoteSchemaValueCache.set(cacheKey, {
          data: schema,
          expiresAt: Date.now() + REMOTE_SCHEMA_VALUE_CACHE_TTL,
        })
      }
      return schema
    } finally {
      remoteSchemaPromiseCache.delete(cacheKey)
    }
  } catch (error) {
    console.error('[loadPageSchema] 加载失败:', route, error)
    return null
  }
}

export async function loadMainInfo(): Promise<MainInfoResult> {
  const cacheToken = getMainInfoCacheToken()
  if (!mainInfoPromise || mainInfoCacheToken !== cacheToken) {
    mainInfoCacheToken = cacheToken
    mainInfoPromise = (async () => {
      const menuApi = joinFrontApi('main/info')
      if (!menuApi) {
        return { menu: [], entry: '', auth: [], authRules: [] }
      }

      const result = await request(menuApi)
      const auth = Array.isArray(result.data?.auth)
        ? result.data.auth.map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
        : []
      const authRules = Array.isArray(result.data?.authRules) ? result.data.authRules : []
      if (getMainInfoCacheToken() === cacheToken) {
        useAuthStore.getState().auth.setAuthList(auth)
        useAuthStore.getState().auth.setAuthRules(authRules)
      }

      return {
        menu: Array.isArray(result.data?.menu) ? result.data.menu : [],
        entry: typeof result.data?.entry === 'string' ? result.data.entry : '',
        auth,
        authRules,
      }
    })()
  }

  return await mainInfoPromise
}

export function resetFrontRuntimeCache(notify = false) {
  clearFrontRuntimeCache()
  if (notify) {
    emitFrontRuntimeRefresh({ reason: 'manual' })
  }
}

function getMainInfoCacheToken() {
  return String(useAuthStore.getState().auth.accessToken || getCookie(ACCESS_TOKEN_KEY) || '')
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
  remoteSchemaPromiseCache.clear()
  remoteSchemaValueCache.clear()
  resetPageProgressCache()
}

function isMainInfoSyncRequest(api: string, method: string) {
  if (normalizeRequestMethod(method) === 'get') {
    return false
  }

  return normalizeApiPath(api) === '/front/main/sync'
}

function normalizeApiPath(api: string) {
  const value = String(api || '').trim()
  if (!value) {
    return ''
  }

  try {
    const base =
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    return normalizePathname(new URL(value, base).pathname)
  } catch {
    return normalizePathname(value.split('?')[0])
  }
}

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}
