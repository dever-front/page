import { getByPath } from './path'
import { normalizeRemoteSearchValue } from './remote-search'
import { loadPageDataContainer } from './request'
import type { PageStore } from './store'

type PageDataPayload = {
  key?: string
  data?: any
  option?: Record<string, any>
}

const DEFAULT_CONTAINER_KEY = 'table'

export async function reloadStoreDataContainer(
  store: PageStore | null | undefined,
  key: string = DEFAULT_CONTAINER_KEY
) {
  if (!store) {
    return false
  }

  const containerKey = normalizeContainerKey(key)
  const state = store.getState()
  const route = String(state.pagePath || '').trim()
  if (!route || !containerKey) {
    return false
  }

  const payload = (await loadPageDataContainer(
    route,
    containerKey,
    buildDataContainerQuery(state.data, containerKey)
  )) as PageDataPayload | null
  if (!payload || !('data' in payload)) {
    return false
  }

  const currentState = store.getState()
  currentState.setValueByPath(`data.${containerKey}`, payload.data)
  if (payload.option && isPlainObject(payload.option)) {
    currentState.setValueByPath('data.option', {
      ...(currentState.data?.option ?? {}),
      ...payload.option,
    })
  }
  return true
}

export function normalizeDataContainerKey(key?: string) {
  const normalized = String(key || DEFAULT_CONTAINER_KEY)
    .trim()
    .replace(/^data\./, '')
  return normalized || DEFAULT_CONTAINER_KEY
}

function buildDataContainerQuery(data: Record<string, any>, containerKey: string) {
  const query: Record<string, unknown> = {}
  appendSearchQuery(query, data?.search)
  appendPageQuery(query, getByPath(data, containerKey))
  return query
}

function appendSearchQuery(query: Record<string, unknown>, search: unknown) {
  if (!isPlainObject(search)) {
    return
  }

  for (const [key, value] of Object.entries(search)) {
    const normalized = normalizeRemoteSearchValue(value)
    if (normalized !== undefined) {
      query[key] = normalized
    }
  }
}

function appendPageQuery(query: Record<string, unknown>, container: unknown) {
  if (!isPlainObject(container)) {
    return
  }

  for (const key of ['page', 'pageSize']) {
    const value = container[key]
    if (value != null && value !== '') {
      query[key] = value
    }
  }
}

function normalizeContainerKey(key: string) {
  return normalizeDataContainerKey(key)
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
