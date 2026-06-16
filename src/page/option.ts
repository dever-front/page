import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import {
  applyOptionFilters,
  buildOptionRegistrySignature,
  collectOptionFilterDependencies,
  sanitizeFilteredValue,
} from '@/lib/option-filter'
import {
  collectOptionParamPaths,
  resolveOptionParams,
} from '@/lib/option-params'
import { getByPath, resolvePath } from '@/lib/path'
import { inferRelationPath, sanitizeRelationValue } from '@/lib/relation-field'
import {
  deleteRemoteOptionPromise,
  getCachedRemoteOptionResult,
  getRemoteOptionPromise,
  setCachedRemoteOptionResult,
  setRemoteOptionPromise,
} from '@/lib/remote-option-cache'
import { joinFrontApi, request } from '@/lib/request'
import {
  appendStoreRouteQueryParams,
  normalizeRoutePagePath,
} from '@/lib/route-context'
import type { Item, OptionItem } from '@/lib/schema'
import { resolveSelectCreateOptionReloadPath } from '@/lib/select-create-option'
import { type PageStore, useStorePathValue } from '@/lib/store'

export type ResolvedNodeOption = {
  option?: OptionItem[]
  optionLoading: boolean
  ensureOptionLoaded?: (
    keyword?: string,
    selectedValue?: unknown
  ) => Promise<OptionItem[] | undefined>
}

export function useNodeOption(
  store: PageStore,
  optionConfig?: Item['option'],
  item?: Pick<Item, 'id' | 'key' | 'type' | 'mode' | 'meta' | 'value'>,
  row?: Record<string, any>
): ResolvedNodeOption {
  const staticOption = useMemo(() => {
    if (Array.isArray(optionConfig)) {
      return optionConfig
    }
    return undefined
  }, [optionConfig])

  const objectRemoteOption = useMemo(
    () => resolveObjectRemoteOptionSource(optionConfig),
    [optionConfig]
  )
  const rawPathOption = useStorePathValue(
    store,
    typeof optionConfig === 'string' && !isRemoteOptionSource(optionConfig)
      ? optionConfig
      : undefined
  )
  const pathOption = Array.isArray(rawPathOption) ? rawPathOption : undefined

  const remoteUrl =
    typeof optionConfig === 'string' && isRemoteOptionSource(optionConfig)
      ? optionConfig
      : objectRemoteOption
        ? joinFrontApi('route/option')
      : ''
  const resetVersion = useStore(store, (state) => state.resetVersion)
  const reloadPaths = useMemo(() => resolveOptionReloadPaths(item), [item])
  const reloadKey = useStore(
    store,
    useCallback(
      (state) =>
        JSON.stringify(
          reloadPaths.map((path) => {
            const { owner, scope, key } = resolvePath(path)
            if (owner === 'parent') {
              return null
            }
            return scope === 'state'
              ? getByPath(state.state, key)
              : getByPath(state.data, key)
          })
        ),
      [reloadPaths]
    )
  )
  const parentStore = store.getState().parentStore ?? store
  const parentReloadKey = useStore(
    parentStore,
    useCallback(
      (state) =>
        JSON.stringify(
          reloadPaths.map((path) => {
            const { owner, scope, key } = resolvePath(path)
            if (owner !== 'parent') {
              return null
            }
            return scope === 'state'
              ? getByPath(state.state, key)
              : getByPath(state.data, key)
          })
        ),
      [reloadPaths]
    )
  )
  const rowOptionParamPaths = useMemo(
    () =>
      collectOptionParamPaths(item?.meta?.optionParams).filter((path) =>
        path.startsWith('row.')
      ),
    [item?.meta?.optionParams]
  )
  const rowReloadKey = useMemo(
    () =>
      JSON.stringify(
        rowOptionParamPaths.map((path) => getByPath(row, path.slice(4)))
      ),
    [row, rowOptionParamPaths]
  )
  const optionRequestRow = rowOptionParamPaths.length > 0 ? row : undefined
  const remoteCacheKey = useMemo(
    () =>
      remoteUrl
        ? `${resetVersion}:${remoteUrl}:${reloadKey}:${parentReloadKey}:${rowReloadKey}`
        : '',
    [parentReloadKey, reloadKey, remoteUrl, resetVersion, rowReloadKey]
  )
  const [remoteOption, setRemoteOption] = useState<OptionItem[] | undefined>(
    undefined
  )
  const [optionLoading, setOptionLoading] = useState(false)
  const pendingRef = useRef<Promise<OptionItem[] | undefined> | null>(null)
  const pendingKeyRef = useRef('')
  const remoteCacheKeyRef = useRef(remoteCacheKey)
  const activeRemoteKeyRef = useRef('')
  const loadedRemoteKeyRef = useRef('')
  const shouldLazyLoad = shouldLazyLoadRemoteOption(item)
  const optionFilterDependencies = useMemo(
    () => collectOptionFilterDependencies(item),
    [item]
  )
  const optionFilterKey = useStore(
    store,
    useCallback(
      (state) =>
        JSON.stringify({
          values: optionFilterDependencies.pathValues.map((path) => {
            const { scope, key } = resolvePath(path)
            return scope === 'state'
              ? getByPath(state.state, key)
              : getByPath(state.data, key)
          }),
          sourceOptions: optionFilterDependencies.sourceNodeIds.map((id) =>
            buildOptionRegistrySignature(state.optionRegistry[id])
          ),
        }),
      [
        optionFilterDependencies.pathValues,
        optionFilterDependencies.sourceNodeIds,
      ]
    )
  )
  const currentValue = useStorePathValue(store, item?.value)

  useEffect(() => {
    remoteCacheKeyRef.current = remoteCacheKey
    setRemoteOption(undefined)
    setOptionLoading(false)
    pendingRef.current = null
    pendingKeyRef.current = ''
    activeRemoteKeyRef.current = ''
    loadedRemoteKeyRef.current = ''
  }, [remoteCacheKey, resetVersion])

  const ensureOptionLoaded = useCallback(
    async (keyword?: string, selectedValue?: unknown) => {
      if (!remoteUrl) {
        return staticOption || pathOption
      }

      const remoteRequestKey = buildRemoteOptionRequestKey(
        remoteCacheKey,
        keyword,
        selectedValue
      )
      activeRemoteKeyRef.current = remoteRequestKey
      if (
        Array.isArray(remoteOption) &&
        loadedRemoteKeyRef.current === remoteRequestKey
      ) {
        return remoteOption
      }

      const cachedRemoteOption = getCachedRemoteOptionResult(remoteRequestKey)
      if (cachedRemoteOption) {
        setRemoteOption(cachedRemoteOption)
        loadedRemoteKeyRef.current = remoteRequestKey
        pendingRef.current = null
        pendingKeyRef.current = ''
        setOptionLoading(false)
        return cachedRemoteOption
      }

      if (pendingRef.current && pendingKeyRef.current === remoteRequestKey) {
        return pendingRef.current
      }
      const sharedPending = getRemoteOptionPromise(remoteRequestKey)
      if (sharedPending) {
        pendingKeyRef.current = remoteRequestKey
        pendingRef.current = sharedPending
          .then((nextOption) => {
            if (
              remoteCacheKeyRef.current === remoteCacheKey &&
              activeRemoteKeyRef.current === remoteRequestKey
            ) {
              setRemoteOption(nextOption)
              loadedRemoteKeyRef.current = remoteRequestKey
            }
            return nextOption
          })
          .finally(() => {
            if (
              remoteCacheKeyRef.current === remoteCacheKey &&
              activeRemoteKeyRef.current === remoteRequestKey
            ) {
              setOptionLoading(false)
              pendingRef.current = null
              pendingKeyRef.current = ''
            }
          })
        setOptionLoading(true)
        return pendingRef.current
      }

      setOptionLoading(true)
      pendingKeyRef.current = remoteRequestKey
      const pending = request(
        buildRemoteOptionURL(
          remoteUrl,
          keyword,
          selectedValue,
          item,
          store,
          optionRequestRow
        )
      )
        .then((result) => {
          const nextOption =
            result.code === 0 && Array.isArray(result.data)
              ? (result.data as OptionItem[])
              : undefined
          if (Array.isArray(nextOption)) {
            setCachedRemoteOptionResult(remoteRequestKey, nextOption)
          }
          if (
            remoteCacheKeyRef.current === remoteCacheKey &&
            activeRemoteKeyRef.current === remoteRequestKey
          ) {
            setRemoteOption(nextOption)
            loadedRemoteKeyRef.current = remoteRequestKey
          }
          return nextOption
        })
        .finally(() => {
          deleteRemoteOptionPromise(remoteRequestKey)
          if (
            remoteCacheKeyRef.current === remoteCacheKey &&
            activeRemoteKeyRef.current === remoteRequestKey
          ) {
            setOptionLoading(false)
            pendingRef.current = null
            pendingKeyRef.current = ''
          }
        })

      pendingRef.current = pending
      setRemoteOptionPromise(remoteRequestKey, pending)
      return pending
    },
    [
      item,
      optionRequestRow,
      pathOption,
      remoteCacheKey,
      remoteOption,
      remoteUrl,
      staticOption,
      store,
    ]
  )

  useEffect(() => {
    if (!remoteUrl || shouldLazyLoad) {
      return
    }
    void ensureOptionLoaded()
  }, [
    ensureOptionLoaded,
    remoteUrl,
    remoteCacheKey,
    resetVersion,
    shouldLazyLoad,
  ])

  useEffect(() => {
    if (
      !remoteUrl ||
      !shouldLazyLoad ||
      !hasSelectedOptionValue(currentValue)
    ) {
      return
    }
    const selectedRequestKey = buildRemoteOptionRequestKey(
      remoteCacheKey,
      undefined,
      currentValue
    )
    if (loadedRemoteKeyRef.current === selectedRequestKey) {
      return
    }
    if (
      optionContainsValue(
        staticOption || pathOption || remoteOption,
        currentValue
      )
    ) {
      return
    }
    void ensureOptionLoaded(undefined, currentValue)
  }, [
    currentValue,
    ensureOptionLoaded,
    pathOption,
    remoteCacheKey,
    remoteOption,
    remoteUrl,
    shouldLazyLoad,
    staticOption,
  ])

  const filteredOption = useMemo(
    () =>
      applyOptionFilters(staticOption || pathOption || remoteOption, item, {
        data: store.getState().data,
        state: store.getState().state,
        optionRegistry: store.getState().optionRegistry,
      }),
    [item, optionFilterKey, pathOption, remoteOption, staticOption, store]
  )
  const optionSignature = useMemo(
    () => buildOptionRegistrySignature(filteredOption),
    [filteredOption]
  )

  useEffect(() => {
    if (!item?.id) {
      return
    }

    store.getState().setOptionItems(item.id, filteredOption || [])
  }, [item?.id, optionSignature, store])

  useEffect(() => {
    if (!item?.value || item.meta?.clearValueWhenFilteredOut === false) {
      return
    }
    if (!optionFilterDependencies.rules.length) {
      return
    }
    if (!filteredOption) {
      return
    }

    const nextValue = sanitizeFilteredValue(currentValue, filteredOption, item)
    const relationPath = inferRelationPath(item.value)
    if (relationPath) {
      const relationValue = store.getState().getValueByPath(relationPath)
      const nextRelationValue = sanitizeRelationValue(
        relationValue,
        nextValue,
        item
      )
      if (nextRelationValue !== relationValue) {
        store.getState().setValueByPath(relationPath, nextRelationValue)
      }
    }

    if (nextValue === currentValue) {
      return
    }

    if (
      Array.isArray(nextValue) &&
      Array.isArray(currentValue) &&
      nextValue.length === currentValue.length &&
      nextValue.every(
        (entry, index) => String(entry) === String(currentValue[index])
      )
    ) {
      return
    }

    store.getState().setValueByPath(item.value, nextValue)
  }, [
    currentValue,
    filteredOption,
    item,
    optionFilterDependencies.rules.length,
    optionSignature,
    store,
  ])

  return {
    option: filteredOption,
    optionLoading,
    ensureOptionLoaded: remoteUrl ? ensureOptionLoaded : undefined,
  }
}

function isRemoteOptionSource(optionConfig: string) {
  const normalized = optionConfig.trim()
  return normalized.startsWith('/') || /^https?:\/\//i.test(normalized)
}

function resolveObjectRemoteOptionSource(optionConfig?: Item['option']) {
  return (
    optionConfig != null &&
    typeof optionConfig === 'object' &&
    !Array.isArray(optionConfig)
  )
}

function buildRemoteOptionRequestKey(
  remoteCacheKey: string,
  keyword?: string,
  selectedValue?: unknown
) {
  return [
    remoteCacheKey,
    normalizeRemoteOptionKeyword(keyword),
    normalizeRemoteOptionSelectedValue(selectedValue),
  ].join(':')
}

function buildRemoteOptionURL(
  remoteUrl: string,
  keyword: string | undefined,
  selectedValue: unknown,
  item: Pick<Item, 'id' | 'key' | 'meta' | 'value'> | undefined,
  store: PageStore,
  row?: Record<string, any>
) {
  const normalizedKeyword = normalizeRemoteOptionKeyword(keyword)
  const normalizedSelected = normalizeRemoteOptionSelectedValue(selectedValue)
  const routeOptionRequest = isFrontRouteOptionURL(remoteUrl)
  const requestUrl = routeOptionRequest
    ? sanitizeRouteOptionURL(remoteUrl)
    : remoteUrl

  const params = routeOptionRequest
    ? readRouteOptionSafeParams(remoteUrl)
    : new URLSearchParams()
  for (const [key, value] of Object.entries(
    resolveOptionParams(item?.meta?.optionParams, { store, row })
  )) {
    params.set(key, value)
  }
  if (
    routeOptionRequest &&
    !hasRemoteOptionParam(remoteUrl, 'path') &&
    !params.has('path')
  ) {
    const pagePath = routeOptionPathWithQuery(store)
    if (pagePath) {
      params.set('path', pagePath)
    }
  }
  applyRouteOptionKeyParam(routeOptionRequest, params, item)
  if (normalizedKeyword) {
    const keywordParam =
      String(item?.meta?.optionKeywordParam || 'keyword').trim() || 'keyword'
    params.set(keywordParam, normalizedKeyword)
  }
  if (normalizedSelected) {
    const selectedParam =
      String(item?.meta?.optionSelectedParam || 'selected').trim() || 'selected'
    params.set(selectedParam, normalizedSelected)
  }
  if (routeOptionRequest) {
    retainRouteOptionParams(params)
  }

  const query = params.toString()
  if (!query) {
    return requestUrl
  }

  return `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}${query}`
}

export function sanitizeRouteOptionURL(api: string) {
  if (!isFrontRouteOptionURL(api)) {
    return api
  }
  try {
    const parsed = new URL(api, window.location.origin)
    return parsed.pathname
  } catch {
    return api.split('?')[0]
  }
}

export function withRouteOptionContext(
  api: string,
  params: Record<string, any> | undefined,
  context: {
    item?: Pick<Item, 'id' | 'key' | 'meta' | 'value'>
    store: PageStore
  }
) {
  const nextParams: Record<string, any> = { ...(params || {}) }
  if (!isFrontRouteOptionURL(api)) {
    return nextParams
  }
  retainRouteOptionObjectParams(nextParams)

  if (!hasParamValue(nextParams.path)) {
    const pagePath = routeOptionPathWithQuery(context.store)
    if (pagePath) {
      nextParams.path = pagePath
    }
  }

  if (!hasParamValue(nextParams.key)) {
    const optionKey = resolveRouteOptionKey(context.item)
    if (optionKey) {
      nextParams.key = optionKey
    }
  }

  return nextParams
}

const routeOptionParamAllowList = new Set([
  'path',
  'key',
  'keyword',
  'selected',
  'parentId',
  'level',
])

function retainRouteOptionParams(params: URLSearchParams) {
  for (const key of Array.from(params.keys())) {
    if (!routeOptionParamAllowList.has(key)) {
      params.delete(key)
    }
  }
}

function retainRouteOptionObjectParams(params: Record<string, any>) {
  for (const key of Object.keys(params)) {
    if (!routeOptionParamAllowList.has(key)) {
      delete params[key]
    }
  }
}

function routeOptionPathWithQuery(store: PageStore) {
  const pagePath = normalizeRoutePagePath(
    store.getState().pagePath || store.getState().schema.page?.route || ''
  )
  if (!pagePath) {
    return ''
  }

  const routeParams = new URLSearchParams()
  appendStoreRouteQueryParams(routeParams, store)
  const query = routeParams.toString()
  return query ? `${pagePath}?${query}` : pagePath
}

function applyRouteOptionKeyParam(
  routeOptionRequest: boolean,
  params: URLSearchParams,
  item: Pick<Item, 'id' | 'key' | 'meta' | 'value'> | undefined
) {
  if (
    !routeOptionRequest ||
    params.has('key')
  ) {
    return
  }

  const optionKey = resolveRouteOptionKey(item)
  if (optionKey) {
    params.set('key', optionKey)
  }
}

function resolveRouteOptionKey(
  item: Pick<Item, 'id' | 'key' | 'meta' | 'value'> | undefined
) {
  const meta = item?.meta ?? {}
  for (const candidate of [
    meta.optionKey,
    (item as Record<string, any> | undefined)?.optionKey,
    item?.key,
    item?.id,
    item?.value,
  ]) {
    const key = normalizeRouteOptionKey(candidate)
    if (key) {
      return key
    }
  }
  return ''
}

function normalizeRouteOptionKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/^data\.option\./, '')
    .replace(/^option\./, '')
}

function hasParamValue(value: unknown) {
  return String(value ?? '').trim() !== ''
}

function readRouteOptionSafeParams(api: string) {
  const params = new URLSearchParams()
  try {
    const parsed = new URL(api, window.location.origin)
    for (const key of [
      'path',
      'key',
      'keyword',
      'selected',
      'parentId',
      'level',
    ]) {
      const value = parsed.searchParams.get(key)
      if (value != null && value !== '') {
        params.set(key, value)
      }
    }
  } catch {
    const [, query = ''] = api.split('?')
    const source = new URLSearchParams(query)
    for (const key of [
      'path',
      'key',
      'keyword',
      'selected',
      'parentId',
      'level',
    ]) {
      const value = source.get(key)
      if (value != null && value !== '') {
        params.set(key, value)
      }
    }
  }
  return params
}

function isFrontRouteOptionURL(remoteUrl: string) {
  const runtimeOptionPath = new URL(
    joinFrontApi('route/option'),
    window.location.origin
  ).pathname
  try {
    const parsed = new URL(remoteUrl, window.location.origin)
    return parsed.pathname === runtimeOptionPath
  } catch {
    return remoteUrl.split('?')[0].endsWith(runtimeOptionPath)
  }
}

function hasRemoteOptionParam(remoteUrl: string, key: string) {
  try {
    return new URL(remoteUrl, window.location.origin).searchParams.has(key)
  } catch {
    const [, query = ''] = remoteUrl.split('?')
    return new URLSearchParams(query).has(key)
  }
}

function normalizeRemoteOptionKeyword(keyword?: string) {
  return String(keyword || '').trim()
}

function normalizeRemoteOptionSelectedValue(value: unknown) {
  if (!hasSelectedOptionValue(value)) {
    return ''
  }
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) => String(item ?? '')).filter(Boolean)
    )
  }
  return String(value).trim()
}

function hasSelectedOptionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.some((item) => String(item ?? '').trim() !== '')
  }
  return String(value ?? '').trim() !== ''
}

function optionContainsValue(
  options: OptionItem[] | undefined,
  value: unknown
) {
  if (!Array.isArray(options) || options.length === 0) {
    return false
  }

  const selected = new Set(normalizeSelectedOptionValues(value))
  if (selected.size === 0) {
    return true
  }

  return options.some((item) => selected.has(String(item.id)))
}

function normalizeSelectedOptionValues(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  const normalized = String(value ?? '').trim()
  return normalized ? [normalized] : []
}

function shouldLazyLoadRemoteOption(
  item?: Pick<Item, 'type' | 'mode' | 'meta'>
) {
  if (!item) {
    return false
  }
  if (typeof item.meta?.optionLazy === 'boolean') {
    return item.meta.optionLazy
  }

  return item.type === 'form-select'
}

function resolveOptionReloadPaths(item?: Pick<Item, 'meta'>) {
  const rawValue = item?.meta?.optionReloadPaths
  const paramPaths = collectOptionParamPaths(item?.meta?.optionParams)
  const createOptionReloadPath = resolveSelectCreateOptionReloadPath(item)
  if (typeof rawValue === 'string') {
    const path = rawValue.trim()
    return Array.from(
      new Set([
        ...(path ? [path] : []),
        ...(createOptionReloadPath ? [createOptionReloadPath] : []),
        ...paramPaths,
      ])
    )
  }

  const explicitPaths = Array.isArray(rawValue)
    ? rawValue.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  return Array.from(
    new Set([
      ...explicitPaths,
      ...(createOptionReloadPath ? [createOptionReloadPath] : []),
      ...paramPaths,
    ])
  )
}
