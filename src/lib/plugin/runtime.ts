import { getRuntimeConfig, type RuntimePluginConfig } from '@/config/app-config'
import type { FrontPluginSDK } from './sdk-compat'
import { type DeverFrontPlugin, type NodeComponentRegistry } from './types'

const GLOBAL_KEY = 'DeverFront'

type FrontPluginRuntimeGlobal = {
  registerPlugin?: (plugin: DeverFrontPlugin) => void
  sdk?: FrontPluginSDK
}

type RuntimeManifestEntry = {
  file?: string
  css?: string[]
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
let sdkPromise: Promise<void> | null = null

export function getRuntimePluginNodes() {
  return runtimeNodes
}

export function getRuntimeNodeLoadError(nodeType: string) {
  return runtimeNodeLoadErrors.get(normalizeNodeType(nodeType)) || ''
}

export function installRuntimeGlobal() {
  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY]!.registerPlugin ||= registerRuntimePlugin
    return
  }

  window[GLOBAL_KEY] = {
    registerPlugin: registerRuntimePlugin,
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
  await ensureRuntimeSDK()

  const entry = plugin.entry
    ? {
        file: plugin.entry,
        css: plugin.css,
        module: plugin.module,
      }
    : await loadManifestEntry(plugin.manifest || '')

  if (!entry?.file) {
    throw new Error(
      `插件 ${plugin.name || plugin.manifest || plugin.entry} 缺少前端入口`
    )
  }

  const baseUrl = plugin.manifest
    ? plugin.manifest.slice(0, plugin.manifest.lastIndexOf('/') + 1)
    : entry.file.slice(0, entry.file.lastIndexOf('/') + 1)
  await Promise.all(
    (entry.css || []).map((file: string) =>
      loadStyle(resolveRuntimeAsset(baseUrl, file))
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

  const entry = findManifestEntry(await response.json())
  if (!entry?.file) {
    throw new Error('插件 manifest 缺少入口文件')
  }
  return entry
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

export async function ensureRuntimeSDK() {
  installRuntimeGlobal()
  if (window[GLOBAL_KEY]?.sdk) {
    return
  }
  if (!sdkPromise) {
    sdkPromise = import('./sdk-compat').then(({ createFrontPluginSDK }) => {
      installRuntimeGlobal()
      window[GLOBAL_KEY]!.sdk = createFrontPluginSDK()
    })
  }
  await sdkPromise
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

function resolveRuntimeAsset(baseUrl: string, file: string) {
  if (/^(https?:)?\/\//.test(file) || file.startsWith('/')) {
    return file
  }
  return baseUrl + file
}

function loadStyle(url: string) {
  return new Promise<void>((resolve) => {
    if (hasHeadAsset('link', 'href', url)) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => resolve()
    link.onerror = () => {
      console.warn('[plugin] 样式加载失败:', url)
      link.remove()
      resolve()
    }
    document.head.appendChild(link)
  })
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
  return Array.from(document.head.getElementsByTagName(tagName)).some(
    (element) => element.getAttribute(attribute) === url
  )
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
