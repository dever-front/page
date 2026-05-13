import type { ActionConfig, Item } from './schema'

export type SelectCreateOptionConfig = {
  name: string
  stateKey: string
  reloadPath: string
  pageRoute?: string
  pageRoutePath?: string
  pageRouteQuery?: Record<string, unknown>
  pageDataPatches?: Record<string, unknown>
  title?: string
  description?: string
  size?: string
  width?: string
  bodyClassName?: string
  footer?: Record<string, unknown>
  success?: string | ActionConfig | Array<string | ActionConfig>
  selectCreated: boolean
  createdValuePath: string
}

type SelectCreateOptionItem = Pick<Item, 'id' | 'meta' | 'name'>

export function resolveSelectCreateOptionConfig(
  item?: SelectCreateOptionItem
): SelectCreateOptionConfig | null {
  const rawConfig = item?.meta?.createOption
  if (!rawConfig || rawConfig === false) {
    return null
  }

  const config = isPlainObject(rawConfig) ? rawConfig : {}
  const pageRoute = normalizeConfigText(config.pageRoute)
  const pageRoutePath = normalizeConfigText(config.pageRoutePath)
  if (!pageRoute && !pageRoutePath) {
    return null
  }

  const stableKey = normalizeSelectCreateOptionKey(item?.id || item?.name || 'option')
  return {
    name: normalizeConfigText(config.name || config.label || config.text) || '新增选项',
    stateKey: normalizeConfigText(config.stateKey) || `selectCreateOption.${stableKey}`,
    reloadPath: normalizeConfigText(config.reloadPath) || `state.selectOptionReload.${stableKey}`,
    pageRoute,
    pageRoutePath,
    pageRouteQuery: normalizeRecord(config.pageRouteQuery),
    pageDataPatches: normalizeRecord(config.pageDataPatches),
    title: normalizeConfigText(config.title),
    description: normalizeConfigText(config.description),
    size: normalizeConfigText(config.size),
    width: normalizeConfigText(config.width),
    bodyClassName: normalizeConfigText(config.bodyClassName),
    footer: normalizeRecord(config.footer),
    success: normalizeCreateSuccess(config.success),
    selectCreated: config.selectCreated === true,
    createdValuePath: normalizeConfigText(config.createdValuePath) || 'id',
  }
}

export function resolveSelectCreateOptionReloadPath(item?: SelectCreateOptionItem) {
  return resolveSelectCreateOptionConfig(item)?.reloadPath || ''
}

function normalizeCreateSuccess(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || undefined
  }
  if (Array.isArray(value)) {
    return value as Array<string | ActionConfig>
  }
  if (isPlainObject(value)) {
    return value as ActionConfig
  }
  return undefined
}

function normalizeRecord(value: unknown) {
  return isPlainObject(value) ? value : undefined
}

function normalizeConfigText(value: unknown) {
  return String(value || '').trim()
}

function normalizeSelectCreateOptionKey(value: unknown) {
  const key = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-')
  return key || 'option'
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
