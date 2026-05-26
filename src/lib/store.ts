/**
 * store.ts - Zustand 页面 store
 * 每个 page 创建独立 store，持有 schema/data/state/action
 * 通过 React Context 传递
 */
import { createContext, useContext } from 'react'
import { createStore, type StoreApi, useStore } from 'zustand'
import { isItemCurrentlyHidden, matchConditionValue } from './condition'
import { resolveNavigationRouteState } from './navigation'
import { getByPath, setByPath, resolvePath } from './path'
import type { PageSchemaType, ActionConfig, Item, ValidateRule } from './schema'

// ========== Store 类型 ==========

export type PageStoreState = {
  schema: PageSchemaType
  pagePath: string
  parentStore: StoreApi<PageStoreState> | null
  data: Record<string, any>
  state: Record<string, any>
  action: Record<string, ActionConfig>
  errors: Record<string, string>
  optionRegistry: Record<string, any[]>
  resetVersion: number

  // 读写 data
  getData: (path: string) => any
  setData: (path: string, value: any) => void

  // 读写 state
  getPageState: (path: string) => any
  setPageState: (path: string, value: any) => void

  // 统一读写（自动区分 data/state）
  getValueByPath: (path: string) => any
  setValueByPath: (path: string, value: any) => void
  setOptionItems: (id: string, items: any[]) => void
  setError: (id: string, message: string) => void
  clearError: (id: string) => void
  validateItem: (item: Item) => boolean
  validateForm: () => boolean

  // 重置
  reset: (schema: PageSchemaType) => void
}

export type PageStore = StoreApi<PageStoreState>

// ========== Store 工厂 ==========

export function createPageStore(
  schema: PageSchemaType,
  pagePath: string = '',
  parentStore: PageStore | null = null
): PageStore {
  let store!: PageStore

  store = createStore<PageStoreState>((set, get) => ({
    schema,
    pagePath,
    parentStore,
    data: structuredClone(schema.data ?? {}),
    state: buildInitialPageState(schema, pagePath),
    action: schema.action ?? {},
    errors: {},
    optionRegistry: {},
    resetVersion: 0,

    getData: (path: string) => getByPath(get().data, path),

    setData: (path: string, value: any) => {
      set((s) => ({ data: setByPath(s.data, path, value) }))
    },

    getPageState: (path: string) => getByPath(get().state, path),

    setPageState: (path: string, value: any) => {
      set((s) => ({ state: setByPath(s.state, path, value) }))
    },

    getValueByPath: (path: string) => getStoreValueByPath(store, path),

    setValueByPath: (path: string, value: any) => {
      setStoreValueByPath(store, path, value)
    },

    setOptionItems: (id: string, items: any[]) => {
      const optionID = String(id || '').trim()
      if (!optionID) {
        return
      }

      set((s) => ({
        optionRegistry: {
          ...s.optionRegistry,
          [optionID]: items,
        },
      }))
    },

    setError: (id: string, message: string) => {
      set((s) => ({ errors: { ...s.errors, [id]: message } }))
    },

    clearError: (id: string) => {
      set((s) => {
        const next = { ...s.errors }
        delete next[id]
        return { errors: next }
      })
    },

    validateItem: (item: Item) => {
      if (!item.id || !item.validate?.length) {
        return true
      }

      const parentSnapshot = getParentScopeSnapshot(
        get().parentStore as PageStore | null
      )

      if (
        isItemCurrentlyHidden(item, get().data, get().state, parentSnapshot)
      ) {
        get().clearError(item.id)
        return true
      }

      const value = item.value ? get().getValueByPath(item.value) : undefined
      const message = getValidationMessage(
        item,
        item.validate,
        value,
        get().getValueByPath
      )

      if (message) {
        get().setError(item.id, message)
        return false
      }

      get().clearError(item.id)
      return true
    },

    validateForm: () => {
      const items = Object.values(get().schema.nodes ?? {}).flat()
      const parentSnapshot = getParentScopeSnapshot(
        get().parentStore as PageStore | null
      )
      let valid = true

      for (const item of items) {
        if (item.mode !== 'form' || !item.validate?.length) {
          continue
        }

        if (
          isItemCurrentlyHidden(item, get().data, get().state, parentSnapshot)
        ) {
          if (item.id) {
            get().clearError(item.id)
          }
          continue
        }

        const itemValid = get().validateItem(item)
        if (!itemValid) {
          valid = false
        }
      }

      return valid
    },

    reset: (newSchema: PageSchemaType) => {
      set((state) => ({
        schema: newSchema,
        pagePath: state.pagePath,
        parentStore: state.parentStore,
        data: structuredClone(newSchema.data ?? {}),
        state: buildInitialPageState(newSchema, state.pagePath),
        action: newSchema.action ?? {},
        errors: {},
        optionRegistry: {},
        resetVersion: state.resetVersion + 1,
      }))
    },
  }))

  return store
}

function buildInitialPageState(schema: PageSchemaType, pagePath: string) {
  const state = structuredClone(schema.state ?? {})
  const routeState = resolveNavigationRouteState(pagePath)
  const existingRoute =
    state.route &&
    typeof state.route === 'object' &&
    !Array.isArray(state.route)
      ? state.route
      : {}

  return {
    ...state,
    route: {
      ...existingRoute,
      ...routeState,
    },
  }
}

// ========== React Context ==========

export const PageStoreContext = createContext<PageStore | null>(null)

export function usePageStore(): PageStore {
  const store = useContext(PageStoreContext)
  if (!store) {
    throw new Error(
      'usePageStore must be used within a PageStoreContext.Provider'
    )
  }
  return store
}

/**
 * 自定义 hook: 从 store 中选取值
 */
export function usePageStoreValue<T>(
  selector: (state: PageStoreState) => T
): T {
  const store = usePageStore()
  // 直接从 store 获取值（需要配合 zustand 的 useStore）
  return selector(store.getState())
}

export function useStorePathValue(store: PageStore, path?: string) {
  const resolved = resolveStorePath(store, path)
  const fallbackStore = resolved.targetStore ?? store

  return useStore(fallbackStore, (state) => {
    if (!path || !resolved.targetStore) {
      return undefined
    }

    return resolved.scope === 'state'
      ? getByPath(state.state, resolved.key)
      : getByPath(state.data, resolved.key)
  })
}

export function getStoreValueByPath(store: PageStore, path?: string) {
  const resolved = resolveStorePath(store, path)
  if (!path || !resolved.targetStore) {
    return undefined
  }

  const targetState = resolved.targetStore.getState()
  return resolved.scope === 'state'
    ? getByPath(targetState.state, resolved.key)
    : getByPath(targetState.data, resolved.key)
}

export function setStoreValueByPath(
  store: PageStore,
  path: string,
  value: any
) {
  const resolved = resolveStorePath(store, path)
  if (!resolved.targetStore) {
    return
  }

  if (resolved.scope === 'state') {
    resolved.targetStore.getState().setPageState(resolved.key, value)
    return
  }

  resolved.targetStore.getState().setData(resolved.key, value)
}

function resolveStorePath(store: PageStore, path?: string) {
  if (!path) {
    return {
      scope: 'data' as const,
      key: '',
      targetStore: null as PageStore | null,
    }
  }

  const resolved = resolvePath(path)
  return {
    scope: resolved.scope,
    key: resolved.key,
    targetStore:
      resolved.owner === 'parent'
        ? ((store.getState().parentStore as PageStore | null) ?? store)
        : store,
  }
}

function getParentScopeSnapshot(parentStore: PageStore | null) {
  if (!parentStore) {
    return null
  }

  const parentState = parentStore.getState()
  return {
    data: parentState.data,
    state: parentState.state,
  }
}

function getValidationMessage(
  item: Item,
  rules: ValidateRule[],
  value: unknown,
  getValueByPath: (path: string) => unknown
) {
  for (const rule of rules) {
    const message = validateRule(item, rule, value, getValueByPath)
    if (message) {
      return message
    }
  }

  return ''
}

function validateRule(
  item: Item,
  rule: ValidateRule,
  value: unknown,
  getValueByPath: (path: string) => unknown
) {
  if (!shouldRunRule(rule, getValueByPath)) {
    return ''
  }

  const normalized = typeof value === 'string' ? value.trim() : value

  switch (rule.type) {
    case 'required':
      if (
        normalized == null ||
        normalized === '' ||
        (Array.isArray(normalized) && normalized.length === 0)
      ) {
        return rule.message || '该字段不能为空。'
      }
      if (item.type === 'form-cascader') {
        if (normalized === 0 || normalized === '0') {
          return rule.message || '该字段不能为空。'
        }
        const requiredLevels = resolveCascaderRequiredLevels(item)
        if (
          requiredLevels > 0 &&
          Array.isArray(normalized) &&
          normalized.length < requiredLevels
        ) {
          return rule.message || '该字段不能为空。'
        }
      }
      return ''

    case 'email':
      if (!normalized) return ''
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(normalized))
        ? ''
        : rule.message || '请输入有效的邮箱地址。'

    case 'pattern':
      if (!normalized || !rule.pattern) return ''
      return new RegExp(rule.pattern).test(String(normalized))
        ? ''
        : rule.message || '输入格式不正确。'

    case 'min':
      if (normalized == null || normalized === '') return ''
      if (typeof normalized === 'number') {
        return normalized >= Number(rule.min ?? 0)
          ? ''
          : rule.message || `不能小于 ${rule.min}。`
      }
      return String(normalized).length >= Number(rule.min ?? 0)
        ? ''
        : rule.message || `长度不能少于 ${rule.min}。`

    case 'max':
      if (normalized == null || normalized === '') return ''
      if (typeof normalized === 'number') {
        return normalized <= Number(rule.max ?? 0)
          ? ''
          : rule.message || `不能大于 ${rule.max}。`
      }
      return String(normalized).length <= Number(rule.max ?? 0)
        ? ''
        : rule.message || `长度不能超过 ${rule.max}。`

    case 'sameAs':
      if (!rule.target) return ''
      return String(normalized ?? '') ===
        String(getValueByPath(rule.target) ?? '')
        ? ''
        : rule.message || '两次输入不一致。'

    default:
      return ''
  }
}

function resolveCascaderRequiredLevels(item: Item) {
  const explicit = Number(item.meta?.requiredLevels ?? 0)
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit
  }

  if (
    Array.isArray(item.meta?.placeholder) &&
    item.meta.placeholder.length > 0
  ) {
    return item.meta.placeholder.length
  }

  return 0
}

function shouldRunRule(
  rule: ValidateRule,
  getValueByPath: (path: string) => unknown
) {
  if (!rule.when?.length) {
    return true
  }

  const condition = rule.condition === 'any' ? 'any' : 'all'
  const results = rule.when.map((item) =>
    matchRuleCondition(item, getValueByPath)
  )

  return condition === 'any' ? results.some(Boolean) : results.every(Boolean)
}

function matchRuleCondition(
  condition: NonNullable<ValidateRule['when']>[number],
  getValueByPath: (path: string) => unknown
) {
  const current = getValueByPath(condition.path)
  return matchConditionValue(
    current,
    condition.operator ?? 'equals',
    condition.value
  )
}
