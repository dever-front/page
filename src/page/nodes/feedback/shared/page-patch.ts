import { getByPath, isScopedStorePath, setByPath } from '@/lib/path'
import type { PageSchemaType } from '@/lib/schema'
import type { PageStore } from '@/lib/store'

type PatchMeta = {
  pageDataPatches?: Record<string, unknown>
  pageLayoutPatches?: Record<string, unknown>
  pageRouteQuery?: Record<string, unknown>
}

export function applyPageSchemaPatches(
  schema: PageSchemaType,
  store: PageStore,
  meta?: PatchMeta
) {
  const nextSchema = structuredClone(schema)

  if (meta?.pageDataPatches) {
    for (const [path, value] of Object.entries(meta.pageDataPatches)) {
      const resolvedValue = resolvePageMetaValue(store, value)
      const currentValue = getByPath(nextSchema.data ?? {}, path)
      nextSchema.data = setByPath(
        nextSchema.data ?? {},
        path,
        mergePatchValue(currentValue, resolvedValue)
      )
    }
  }

  if (meta?.pageLayoutPatches) {
    for (const [path, value] of Object.entries(meta.pageLayoutPatches)) {
      nextSchema.layout = setByPath(nextSchema.layout ?? {}, path, value)
    }
  }

  return nextSchema
}

export function resolvePageMetaValue(store: PageStore, value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => resolvePageMetaValue(store, item))
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolvePageMetaValue(store, item)])
    )
  }

  if (typeof value !== 'string') {
    return clonePatchValue(value)
  }

  if (isScopedStorePath(value)) {
    return clonePatchValue(store.getState().getValueByPath(value))
  }

  return value
}

export function buildPageRouteWithQuery(
  route: string | undefined,
  store: PageStore,
  meta?: PatchMeta
) {
  const currentRoute = String(route ?? '').trim()
  if (!currentRoute) {
    return ''
  }

  const [pathname, rawQuery = ''] = currentRoute.split('?')
  const searchParams = new URLSearchParams(rawQuery)

  for (const [key, value] of Object.entries(meta?.pageRouteQuery ?? {})) {
    applyRouteQueryValue(searchParams, key, resolvePageMetaValue(store, value))
  }

  const queryString = searchParams.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

function applyRouteQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: unknown
) {
  if (!key) {
    return
  }

  searchParams.delete(key)

  if (value == null) {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendRouteQueryValue(searchParams, key, item)
    }
    return
  }

  appendRouteQueryValue(searchParams, key, value)
}

function appendRouteQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: unknown
) {
  if (value == null || typeof value === 'object') {
    return
  }

  const text = String(value)
  if (!text.trim()) {
    return
  }

  searchParams.append(key, text)
}

function mergePatchValue(currentValue: unknown, patchValue: unknown): unknown {
  if (!isPlainObject(currentValue) || !isPlainObject(patchValue)) {
    return clonePatchValue(patchValue)
  }

  const merged: Record<string, unknown> = { ...currentValue }
  for (const [key, value] of Object.entries(patchValue)) {
    merged[key] = mergePatchValue(currentValue[key], value)
  }
  return merged
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function clonePatchValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value
  }
  return structuredClone(value)
}
