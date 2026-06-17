import { loadPageSchema } from './request'
import { validatePageSchema, type PageSchemaType } from './schema'
import type { PageStore } from './store'
import {
  normalizeDataContainerKey,
  reloadStoreDataContainer,
} from './page-data-reload'
import { getByPath } from './path'

type RemoteDataState = {
  search: any
  containers: Record<string, { page: any; pageSize: any }>
}

export async function reloadStorePageSchema(store: PageStore) {
  const route = resolveStorePageRoute(store)
  if (!route) {
    return false
  }

  const raw = await loadPageSchema(route, { skipValueCache: true })
  if (!raw) {
    return false
  }

  const remoteState = captureRemoteDataState(store)
  store.getState().reset(validatePageSchema(raw))
  restoreRemoteDataState(store, remoteState)
  await reloadDefaultRemoteData(store)
  return true
}

function resolveStorePageRoute(store: PageStore) {
  const state = store.getState()
  return String(state.pagePath || state.schema.page?.route || '').trim()
}

async function reloadDefaultRemoteData(store: PageStore) {
  const state = store.getState()
  const containerKeys = collectRemoteDataContainerKeys(state.schema)
  if (containerKeys.length === 0) {
    return false
  }

  await Promise.all(
    containerKeys.map((containerKey) =>
      reloadStoreDataContainer(store, containerKey)
    )
  )
  return true
}

function captureRemoteDataState(store: PageStore): RemoteDataState | null {
  const state = store.getState()
  const containerKeys = collectRemoteDataContainerKeys(state.schema)
  if (containerKeys.length === 0) {
    return null
  }

  return {
    search: cloneValue(state.data?.search),
    containers: Object.fromEntries(
      containerKeys.map((containerKey) => [
        containerKey,
        {
          page: getByPath(state.data, `${containerKey}.page`),
          pageSize: getByPath(state.data, `${containerKey}.pageSize`),
        },
      ])
    ),
  }
}

function restoreRemoteDataState(
  store: PageStore,
  remoteState: RemoteDataState | null
) {
  if (!remoteState) {
    return
  }

  const state = store.getState()
  if (remoteState.search && typeof remoteState.search === 'object') {
    state.setValueByPath('data.search', {
      ...(state.data?.search ?? {}),
      ...remoteState.search,
    })
  }

  for (const [containerKey, containerState] of Object.entries(
    remoteState.containers
  )) {
    if (containerState.page != null && containerState.page !== '') {
      state.setValueByPath(`data.${containerKey}.page`, containerState.page)
    }
    if (containerState.pageSize != null && containerState.pageSize !== '') {
      state.setValueByPath(
        `data.${containerKey}.pageSize`,
        containerState.pageSize
      )
    }
  }
}

function collectRemoteDataContainerKeys(schema: PageSchemaType) {
  const keys = new Set<string>()
  const nodes = schema?.nodes ?? {}

  for (const items of Object.values(nodes)) {
    for (const item of items) {
      if (item.type !== 'show-table' || item.meta?.remote !== true) {
        continue
      }

      keys.add(resolveDataContainerKey(item.value, item.meta?.reloadDataKey))
    }
  }

  return Array.from(keys)
}

function resolveDataContainerKey(valuePath?: string, reloadDataKey?: string) {
  const normalizedReloadKey = String(reloadDataKey || '')
    .trim()
    .replace(/^data\./, '')
  if (normalizedReloadKey) {
    return normalizeDataContainerKey(normalizedReloadKey)
  }

  const normalizedValuePath = String(valuePath || '')
    .trim()
    .replace(/^data\./, '')
  const inferredKey = normalizedValuePath.split('.').filter(Boolean)[0]
  return normalizeDataContainerKey(inferredKey || 'table')
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value
  }
  return structuredClone(value)
}
