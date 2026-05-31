type ThemeMode = 'system' | 'light' | 'dark'
type SidebarMode = 'inset' | 'floating' | 'sidebar'
type LayoutMode = 'default' | 'compact' | 'full'
type DirectionMode = 'ltr' | 'rtl'

export type SiteConfig = {
  name: string
  subtitle: string
  description: string
  url: string
  favicon: string
  logo?: string
}

export type AppearanceConfig = {
  theme: ThemeMode
  sidebar: SidebarMode
  layout: LayoutMode
  direction: DirectionMode
}

export type RuntimeConfig = {
  siteKey: string
  skin: string
  routerMode: 'hash' | 'history'
  basePath?: string
  host: string
  access?: RuntimeAccessConfig
  plugins?: string[]
}

export type AppConfig = {
  site: SiteConfig
  appearance: AppearanceConfig
  runtime: RuntimeConfig
}

export type RuntimeAccessConfig = {
  mode: string
  authProvider: string
}

export type RuntimeSettingConfig = {
  skin?: string
  routerMode?: 'hash' | 'history'
  plugins?: string[]
}

export type AppRuntimeConfig = {
  siteKey?: string
  basePath?: string
  apiHost?: string
  site?: Partial<SiteConfig>
  appearance?: Partial<AppearanceConfig>
  runtime?: RuntimeSettingConfig
  access?: RuntimeAccessConfig
}

declare global {
  interface Window {
    appRuntime?: AppRuntimeConfig
  }
}

const DEFAULT_APP_CONFIG: AppConfig = {
  site: {
    name: '',
    subtitle: '',
    description: '',
    url: '',
    logo: '',
    favicon: '',
  },
  appearance: {
    theme: 'light',
    sidebar: 'floating',
    layout: 'compact',
    direction: 'ltr',
  },
  runtime: {
    siteKey: 'admin',
    skin: 'default',
    routerMode: 'history',
    host: '',
  },
}

export function getAppConfig(): AppConfig {
  return mergeRuntimeConfig(window.appRuntime)
}

export function getSiteConfig() {
  return getAppConfig().site
}

export function getAppearanceConfig() {
  return getAppConfig().appearance
}

export function getRuntimeConfig() {
  return getAppConfig().runtime
}

export function getDefaultSidebarOpen() {
  return getAppearanceConfig().layout === 'default'
}

export function getDefaultCollapsibleMode(): 'offcanvas' | 'icon' {
  return getAppearanceConfig().layout === 'full' ? 'offcanvas' : 'icon'
}

function mergeRuntimeConfig(runtime?: AppRuntimeConfig): AppConfig {
  const basePath = normalizeBasePath(
    runtime?.basePath || DEFAULT_APP_CONFIG.runtime.basePath
  )
  const host = normalizeAPIHost(
    runtime?.apiHost || DEFAULT_APP_CONFIG.runtime.host
  )
  const siteKey = String(
    runtime?.siteKey || DEFAULT_APP_CONFIG.runtime.siteKey || 'admin'
  )
  const site = normalizeSiteConfig(DEFAULT_APP_CONFIG.site, runtime?.site)

  if (basePath) {
    site.url = site.url || basePath
    site.logo = site.logo || joinBasePath(basePath, 'assets/images/logo.svg')
    site.favicon =
      site.favicon || joinBasePath(basePath, 'assets/images/favicon.svg')
  }

  return {
    ...DEFAULT_APP_CONFIG,
    site,
    appearance: normalizeAppearanceConfig(
      DEFAULT_APP_CONFIG.appearance,
      runtime?.appearance
    ),
    runtime: normalizeRuntimeConfig(
      {
        ...DEFAULT_APP_CONFIG.runtime,
        siteKey,
        basePath,
        host,
        access: runtime?.access || DEFAULT_APP_CONFIG.runtime.access,
      },
      runtime?.runtime
    ),
  }
}

function normalizeRuntimeConfig(
  defaults: RuntimeConfig,
  runtime?: RuntimeSettingConfig
): RuntimeConfig {
  return {
    ...defaults,
    skin: String(runtime?.skin || defaults.skin || 'default').trim(),
    routerMode: normalizeChoice(
      runtime?.routerMode || defaults.routerMode,
      ['hash', 'history'],
      'history'
    ),
    plugins: normalizeStringList(runtime?.plugins || defaults.plugins),
  }
}

function normalizeAppearanceConfig(
  defaults?: Partial<AppearanceConfig>,
  runtime?: Partial<AppearanceConfig>
): AppearanceConfig {
  const appearance = {
    ...(defaults || {}),
    ...(runtime || {}),
  }

  return {
    theme: normalizeChoice(
      appearance.theme,
      ['system', 'light', 'dark'],
      'light'
    ),
    sidebar: normalizeChoice(
      appearance.sidebar,
      ['inset', 'floating', 'sidebar'],
      'floating'
    ),
    layout: normalizeChoice(
      appearance.layout,
      ['default', 'compact', 'full'],
      'compact'
    ),
    direction: normalizeChoice(appearance.direction, ['ltr', 'rtl'], 'ltr'),
  }
}

function normalizeSiteConfig(
  defaults?: Partial<SiteConfig>,
  runtime?: Partial<SiteConfig>
): SiteConfig {
  const site = {
    ...(defaults || {}),
    ...(runtime || {}),
  }

  return {
    name: String(site.name || ''),
    subtitle: String(site.subtitle || ''),
    description: String(site.description || ''),
    url: String(site.url || ''),
    logo: String(site.logo || ''),
    favicon: String(site.favicon || ''),
  }
}

function normalizeChoice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  const normalized = String(value || '').trim() as T
  return allowed.includes(normalized) ? normalized : fallback
}

function normalizeBasePath(value?: string) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }
  if (normalized === '/') {
    return '/'
  }
  return `/${normalized.replace(/^\/+|\/+$/g, '')}`
}

function normalizeAPIHost(value?: string) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function joinBasePath(basePath: string, relativePath: string) {
  const base = String(basePath || '').replace(/\/+$/, '')
  const rel = String(relativePath || '').replace(/^\/+/, '')
  return base ? `${base}/${rel}` : `/${rel}`
}

function normalizeStringList(values?: string[]) {
  if (!Array.isArray(values)) {
    return undefined
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const normalized = String(value || '').trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }
  return result.length > 0 ? result : undefined
}
