import { getByPath, resolvePath } from './path'
import type { Item } from './schema'
import type { PageStore, PageStoreState } from './store'

const EMPTY_LAYOUT_ITEMS: Item[] = []
type RemoteSearchEntry = {
  path: string
  key: string
}

export function isRemoteSearchField(item?: Pick<Item, 'mode' | 'meta' | 'value'>) {
  return (
    item?.mode === 'search' &&
    item.meta?.remote !== false &&
    getRemoteSearchKey(item.value) !== ''
  )
}

export function resolveRemoteSearchMode(items?: Item[]) {
  return hasRemoteSearchSubmitButton(items) ? 'manual' : 'auto'
}

export function isManualRemoteSearchLayout(
  schema: Pick<PageStoreState, 'schema'>['schema'],
  layoutId?: string
) {
  return resolveRemoteSearchMode(getRemoteSearchLayoutItems(schema, layoutId)) === 'manual'
}

export function getRemoteSearchLayoutItems(
  schema: Pick<PageStoreState, 'schema'>['schema'],
  layoutId?: string
) {
  const layoutIds = resolveRemoteSearchLayoutIds(layoutId)
  if (layoutIds.length === 0) {
    return EMPTY_LAYOUT_ITEMS
  }

  const items = layoutIds.flatMap((currentLayoutID) => {
    const layoutItems = schema.nodes?.[currentLayoutID]
    return Array.isArray(layoutItems) ? layoutItems : EMPTY_LAYOUT_ITEMS
  })

  return items.length > 0 ? items : EMPTY_LAYOUT_ITEMS
}

export function buildRemoteSearchPatch(
  storeState: Pick<PageStoreState, 'schema' | 'data' | 'state'>,
  layoutId?: string
) {
  const items = getRemoteSearchFields(storeState.schema, layoutId)
  const patch: Record<string, unknown> = { page: undefined }

  for (const item of items) {
    for (const entry of getRemoteSearchEntries(item)) {
      const { scope, key: pathKey } = resolvePath(entry.path)
      const source = scope === 'state' ? storeState.state : storeState.data
      patch[entry.key] = normalizeRemoteSearchValue(getByPath(source, pathKey))
    }
  }

  return patch
}

export function buildRemoteSearchResetPatch(
  schema: Pick<PageStoreState, 'schema'>['schema'],
  layoutId?: string
) {
  const patch: Record<string, unknown> = { page: undefined }

  for (const item of getRemoteSearchFields(schema, layoutId)) {
    for (const entry of getRemoteSearchEntries(item)) {
      patch[entry.key] = undefined
    }
  }

  return patch
}

export function resetRemoteSearchValues(store: PageStore, layoutId?: string) {
  const state = store.getState()
  for (const item of getRemoteSearchFields(state.schema, layoutId)) {
    for (const entry of getRemoteSearchEntries(item)) {
      const { scope, key } = resolvePath(entry.path)
      const source = scope === 'state' ? state.schema.state : state.schema.data
      const defaultValue = cloneSearchValue(getByPath(source ?? {}, key))
      state.setValueByPath(entry.path, defaultValue)
    }
  }
}

function getRemoteSearchFields(
  schema: Pick<PageStoreState, 'schema'>['schema'],
  layoutId?: string
) {
  return getRemoteSearchLayoutItems(schema, layoutId).filter(
    (item): item is Item & { value: string } => isRemoteSearchField(item) && !!item.value
  )
}

function getRemoteSearchEntries(item: Pick<Item, 'value' | 'meta'>): RemoteSearchEntry[] {
  const primaryPath = String(item.value || '').trim()
  const entries: RemoteSearchEntry[] = []

  appendRemoteSearchEntry(entries, primaryPath)

  if (item.meta?.range === true) {
    appendRemoteSearchEntry(
      entries,
      String(item.meta?.endValue || item.meta?.endPath || '').trim()
    )
  }

  return entries
}

function appendRemoteSearchEntry(entries: RemoteSearchEntry[], path: string) {
  const key = getRemoteSearchKey(path)
  if (!path || !key || entries.some((entry) => entry.key === key)) {
    return
  }

  entries.push({ path, key })
}

function hasRemoteSearchSubmitButton(items?: Item[]) {
  return (items || []).some(
    (item) => item.type === 'show-button' && item.meta?.searchSubmit === true
  )
}

function resolveRemoteSearchLayoutIds(layoutId?: string) {
  return String(layoutId || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

export function getRemoteSearchKey(valuePath?: string) {
  const path = String(valuePath || '').trim()
  if (!path) {
    return ''
  }

  const parts = path.split('.').filter(Boolean)
  return parts.at(-1) || ''
}

export function normalizeRemoteSearchValue(value: unknown) {
  if (value == null) {
    return undefined
  }
  if (typeof value === 'string') {
    return value === '' || value === '__all__' ? undefined : value
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value : undefined
  }
  return value
}

function cloneSearchValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value
  }
  return structuredClone(value)
}
