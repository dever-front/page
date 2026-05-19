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
  skin: string
  routerMode: 'hash' | 'history'
  basePath?: string
  host: string
}

export type AppConfig = {
  site: SiteConfig
  appearance: AppearanceConfig
  runtime: RuntimeConfig
}

declare global {
  interface Window {
    appConfig: AppConfig
  }
}

export function getAppConfig(): AppConfig {
  return window.appConfig
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
