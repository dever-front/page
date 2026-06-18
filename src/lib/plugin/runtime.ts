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
const loadingPlugins = new Map<string, Promise<void>>()
let sdkPromise: Promise<void> | null = null

export function getRuntimePluginNodes() {
  return runtimeNodes
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
  Object.assign(runtimeNodes, plugin.nodes)
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

  await Promise.allSettled(
    matched.map((plugin) => loadRuntimePluginWithDependencies(plugin))
  )
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
    return
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
    return undefined
  }

  const response = await fetch(manifestUrl, { credentials: 'same-origin' })
  if (!response.ok) {
    return undefined
  }

  return findManifestEntry(await response.json())
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
    if (document.querySelector(`link[href="${url}"]`)) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => resolve()
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })
}

function loadScript(url: string, module: boolean) {
  return new Promise<void>((resolve) => {
    if (document.querySelector(`script[src="${url}"]`)) {
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
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
  )
}
