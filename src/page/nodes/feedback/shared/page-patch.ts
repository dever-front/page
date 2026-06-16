import { getByPath, isScopedStorePath, setByPath } from '@/lib/path'
import { buildInheritedPageRoute } from '@/lib/route-inherit'
import { appendRouteQueryParams } from '@/lib/route-context'
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

  const inheritedRoute = buildInheritedPageRoute(currentRoute, store)
  const [pathname, rawQuery = ''] = inheritedRoute.split('?')
  const searchParams = new URLSearchParams(rawQuery)
  appendRouteQueryParams(searchParams, resolvePageRouteQuery(store, meta), {
    objectMode: 'skip',
    overwrite: true,
    skipPath: false,
  })

  const queryString = searchParams.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

function resolvePageRouteQuery(store: PageStore, meta?: PatchMeta) {
  return Object.fromEntries(
    Object.entries(meta?.pageRouteQuery ?? {}).map(([key, value]) => [
      key,
      resolvePageMetaValue(store, value),
    ])
  )
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
