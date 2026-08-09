import { getRuntimeConfig, type RuntimePluginConfig } from '@/config/app-config'
import type { FrontPluginSDK } from './sdk-compat'
import { type DeverFrontPlugin, type NodeComponentRegistry } from './types'

const GLOBAL_KEY = 'DeverFront'

type FrontPluginRuntimeGlobal = {
  registerPlugin?: (plugin: DeverFrontPlugin) => void
  ensureCompat?: (sources?: string[]) => Promise<void>
  ensureStyles?: (urls: string[]) => Promise<void>
  sdk?: FrontPluginSDK
}

type RuntimeManifestEntry = {
  file?: string
  css?: string[]
  compat?: string[]
  compatMode?: 'module'
  isEntry?: boolean
  module?: boolean
}

declare global {
  interface Window {
    DeverFront?: FrontPluginRuntimeGlobal
  }
}

const runtimeNodes: NodeComponentRegistry = {}
const runtimeNodeLoadErrors = new Map<string, string>()
const loadingPlugins = new Map<string, Promise<void>>()
const loadingStyles = new Map<string, Promise<void>>()
let sdkModulePromise: Promise<typeof import('./sdk-compat')> | null = null

export function getRuntimePluginNodes() {
  return runtimeNodes
}

export function getRuntimeNodeLoadError(nodeType: string) {
  return runtimeNodeLoadErrors.get(normalizeNodeType(nodeType)) || ''
}

export function installRuntimeGlobal() {
  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY]!.registerPlugin ||= registerRuntimePlugin
    window[GLOBAL_KEY]!.ensureCompat ||= ensureRuntimeSDK
    window[GLOBAL_KEY]!.ensureStyles ||= ensureRuntimeStyles
    return
  }

  window[GLOBAL_KEY] = {
    registerPlugin: registerRuntimePlugin,
    ensureCompat: ensureRuntimeSDK,
    ensureStyles: ensureRuntimeStyles,
  }
}

function registerRuntimePlugin(plugin: DeverFrontPlugin) {
  if (!plugin?.name) {
    return
  }
  Object.assign(runtimeNodes, plugin.nodes || {})
  Object.keys(plugin.nodes || {}).forEach((nodeType) => {
    runtimeNodeLoadErrors.delete(normalizeNodeType(nodeType))
  })
}

export async function ensurePluginsForNodes(nodeTypes: string[]) {
  const types = uniqueStrings(nodeTypes)
  if (types.length === 0) {
    return
  }

  const plugins = runtimePluginConfigs()
  const matched = plugins.filter((plugin) =>
    pluginMatchesNodeTypes(plugin, types)
  )

  markMissingPluginNodes(types, matched)

  const results = await Promise.allSettled(
    matched.map((plugin) => loadRuntimePluginWithDependencies(plugin))
  )

  results.forEach((result, index) => {
    const plugin = matched[index]
    if (!plugin) {
      return
    }

    if (result.status === 'rejected') {
      markPluginNodes(
        plugin,
        types,
        result.reason instanceof Error
          ? result.reason.message
          : '插件加载失败'
      )
      return
    }

    markUnregisteredPluginNodes(plugin, types)
  })
}

async function loadRuntimePluginWithDependencies(
  plugin: RuntimePluginConfig,
  stack = new Set<string>()
) {
  const key = runtimePluginKey(plugin)
  if (!key || loadingPlugins.has(key)) {
    return loadingPlugins.get(key)
  }

  const promise = (async () => {
    if (stack.has(key)) {
      return
    }
    stack.add(key)
    try {
      for (const dependencyName of plugin.depends || []) {
        const dependency = runtimePluginConfigs().find(
          (item) => item.name === dependencyName
        )
        if (dependency) {
          await loadRuntimePluginWithDependencies(dependency, stack)
        }
      }

      await loadRuntimePlugin(plugin)
    } finally {
      stack.delete(key)
    }
  })()

  promise.catch(() => {
    if (loadingPlugins.get(key) === promise) {
      loadingPlugins.delete(key)
    }
  })
  loadingPlugins.set(key, promise)
  return promise
}

async function loadRuntimePlugin(plugin: RuntimePluginConfig) {
  installRuntimeGlobal()

  const entry = plugin.entry
    ? {
        file: plugin.entry,
        css: plugin.css,
        compat: plugin.compat,
        compatMode: plugin.compatMode,
        module: plugin.module,
      }
    : await loadManifestEntry(plugin.manifest || '')

  if (!entry?.file) {
    throw new Error(
      `插件 ${plugin.name || plugin.manifest || plugin.entry} 缺少前端入口`
    )
  }
  // Module-scoped plugins resolve compat from their own lazy chunks. Older
  // manifests retain the eager list so existing published plugins still work.
  await ensureRuntimeSDK(entry.compatMode === 'module' ? [] : entry.compat)

  const baseUrl = plugin.manifest
    ? plugin.manifest.slice(0, plugin.manifest.lastIndexOf('/') + 1)
    : entry.file.slice(0, entry.file.lastIndexOf('/') + 1)
  await ensureRuntimeStyles(
    (entry.css || []).map((file: string) =>
      resolveRuntimeAsset(baseUrl, file)
    )
  )
  await loadScript(resolveRuntimeAsset(baseUrl, entry.file), !!entry.module)
}

async function loadManifestEntry(manifestUrl: string) {
  if (!manifestUrl) {
    throw new Error('插件缺少 manifest 地址')
  }

  const response = await fetch(manifestUrl, { credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(`插件 manifest 加载失败(${response.status})`)
  }

  const manifest = await response.json()
  const entry = findManifestEntry(manifest)
  if (!entry?.file) {
    throw new Error('插件 manifest 缺少入口文件')
  }
  return {
    ...entry,
    compat: manifestCompatSources(manifest),
    compatMode: manifestCompatMode(manifest),
  }
}

function runtimePluginConfigs() {
  return getRuntimeConfig().plugins || []
}

function pluginMatchesNodeTypes(
  plugin: RuntimePluginConfig,
  nodeTypes: string[]
) {
  if (!plugin.nodes?.length) {
    return false
  }
  const nodeSet = new Set(plugin.nodes)
  return nodeTypes.some((type) => nodeSet.has(type))
}

export async function ensureRuntimeSDK(compat?: string[]) {
  installRuntimeGlobal()
  if (!sdkModulePromise) {
    sdkModulePromise = import('./sdk-compat')
  }
  const sdkModule = await sdkModulePromise
  if (!window[GLOBAL_KEY]?.sdk) {
    window[GLOBAL_KEY]!.sdk = sdkModule.createFrontPluginSDK()
  }
  await sdkModule.ensureCompatModules(compat)
}

function runtimePluginKey(plugin: RuntimePluginConfig) {
  return plugin.name || plugin.entry || plugin.manifest || ''
}

function findManifestEntry(
  manifest: unknown
): RuntimeManifestEntry | undefined {
  if (!manifest || typeof manifest !== 'object') {
    return undefined
  }

  const entries = Object.values(
    manifest as Record<string, RuntimeManifestEntry>
  )
  return (
    entries.find((entry) => entry?.isEntry) ||
    entries.find((entry) => String(entry?.file || '').endsWith('.js'))
  )
}

function manifestCompatSources(manifest: unknown) {
  if (!manifest || typeof manifest !== 'object') {
    return undefined
  }
  const metadata = (manifest as Record<string, unknown>).__plugin
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined
  }
  if (!Object.prototype.hasOwnProperty.call(metadata, 'compat')) {
    return undefined
  }
  const compat = (metadata as Record<string, unknown>).compat
  if (!Array.isArray(compat)) {
    return undefined
  }
  return uniqueStrings(compat.map((source) => String(source || '')))
}

function manifestCompatMode(manifest: unknown): 'module' | undefined {
  if (!manifest || typeof manifest !== 'object') {
    return undefined
  }
  const metadata = (manifest as Record<string, unknown>).__plugin
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined
  }
  return (metadata as Record<string, unknown>).compatMode === 'module'
    ? 'module'
    : undefined
}

function resolveRuntimeAsset(baseUrl: string, file: string) {
  if (/^(https?:)?\/\//.test(file) || file.startsWith('/')) {
    return file
  }
  return baseUrl + file
}

export async function ensureRuntimeStyles(urls: string[]) {
  const normalizedUrls = uniqueStrings(urls).map(normalizeHeadAssetUrl)
  await Promise.all(normalizedUrls.map(loadStyle))
}

function loadStyle(url: string) {
  const normalizedUrl = normalizeHeadAssetUrl(url)
  const pendingStyle = loadingStyles.get(normalizedUrl)
  if (pendingStyle) {
    return pendingStyle
  }
  if (hasHeadAsset('link', 'href', normalizedUrl)) {
    return Promise.resolve()
  }

  const stylePromise = new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = normalizedUrl
    link.onload = () => {
      loadingStyles.delete(normalizedUrl)
      resolve()
    }
    link.onerror = () => {
      loadingStyles.delete(normalizedUrl)
      console.warn('[plugin] 样式加载失败:', normalizedUrl)
      link.remove()
      resolve()
    }
    document.head.appendChild(link)
  })
  loadingStyles.set(normalizedUrl, stylePromise)
  return stylePromise
}

function loadScript(url: string, module: boolean) {
  return new Promise<void>((resolve, reject) => {
    if (hasHeadAsset('script', 'src', url)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = url
    if (module) {
      script.type = 'module'
    }
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error(`插件脚本加载失败: ${url}`))
    }
    document.head.appendChild(script)
  })
}

function hasHeadAsset(
  tagName: 'link' | 'script',
  attribute: string,
  url: string
) {
  const normalizedUrl = normalizeHeadAssetUrl(url)
  return Array.from(document.head.getElementsByTagName(tagName)).some(
    (element) =>
      normalizeHeadAssetUrl(element.getAttribute(attribute) || '') ===
      normalizedUrl
  )
}

function normalizeHeadAssetUrl(url: string) {
  try {
    return new URL(url, document.baseURI).href
  } catch {
    return url
  }
}

function markMissingPluginNodes(
  nodeTypes: string[],
  plugins: RuntimePluginConfig[]
) {
  const matchedTypes = new Set<string>()
  plugins.forEach((plugin) => {
    ;(plugin.nodes || []).forEach((nodeType) => {
      const normalizedNodeType = normalizeNodeType(nodeType)
      if (nodeTypes.includes(normalizedNodeType)) {
        matchedTypes.add(normalizedNodeType)
      }
    })
  })

  nodeTypes.forEach((nodeType) => {
    const normalizedNodeType = normalizeNodeType(nodeType)
    if (runtimeNodes[normalizedNodeType]) {
      runtimeNodeLoadErrors.delete(normalizedNodeType)
      return
    }
    if (!matchedTypes.has(normalizedNodeType)) {
      runtimeNodeLoadErrors.set(
        normalizedNodeType,
        `未找到提供节点 ${normalizedNodeType} 的插件`
      )
    }
  })
}

function markPluginNodes(
  plugin: RuntimePluginConfig,
  requestedTypes: string[],
  message: string
) {
  const requestedTypeSet = new Set(requestedTypes)
  ;(plugin.nodes || []).forEach((nodeType) => {
    const normalizedNodeType = normalizeNodeType(nodeType)
    if (
      requestedTypeSet.has(normalizedNodeType) &&
      !runtimeNodes[normalizedNodeType]
    ) {
      runtimeNodeLoadErrors.set(normalizedNodeType, message)
    }
  })
}

function markUnregisteredPluginNodes(
  plugin: RuntimePluginConfig,
  requestedTypes: string[]
) {
  const requestedTypeSet = new Set(requestedTypes)
  ;(plugin.nodes || []).forEach((nodeType) => {
    const normalizedNodeType = normalizeNodeType(nodeType)
    if (!requestedTypeSet.has(normalizedNodeType)) {
      return
    }
    if (runtimeNodes[normalizedNodeType]) {
      runtimeNodeLoadErrors.delete(normalizedNodeType)
      return
    }
    runtimeNodeLoadErrors.set(
      normalizedNodeType,
      `插件 ${plugin.name || plugin.manifest || plugin.entry} 已加载但未注册节点 ${normalizedNodeType}`
    )
  })
}

function normalizeNodeType(value: string) {
  return String(value || '').trim()
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
  )
}
