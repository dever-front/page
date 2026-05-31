import { getRuntimeConfig } from '@/config/app-config'
import type { DeverFrontPlugin, NodeComponentRegistry } from './types'

const GLOBAL_KEY = 'DeverFront'

type FrontPluginRuntimeGlobal = {
  registerPlugin: (plugin: DeverFrontPlugin) => void
}

declare global {
  interface Window {
    DeverFront?: FrontPluginRuntimeGlobal
  }
}

const runtimeNodes: NodeComponentRegistry = {}

export function getRuntimePluginNodes() {
  return runtimeNodes
}

export async function loadRuntimeFrontPlugins() {
  installRuntimeGlobal()

  if (import.meta.env.DEV) {
    return
  }

  const manifestUrls = runtimePluginManifestUrls()
  for (const manifestUrl of manifestUrls) {
    await loadRuntimePlugin(manifestUrl)
  }
}

function installRuntimeGlobal() {
  window[GLOBAL_KEY] = {
    registerPlugin(plugin) {
      if (!plugin?.name) {
        return
      }
      Object.assign(runtimeNodes, plugin.nodes)
    },
  }
}

function runtimePluginManifestUrls() {
  const plugins = getRuntimeConfig().plugins
  if (!Array.isArray(plugins)) {
    return []
  }
  return plugins.map((url) => String(url || '').trim()).filter(Boolean)
}

async function loadRuntimePlugin(manifestUrl: string) {
  const response = await fetch(manifestUrl, { credentials: 'same-origin' })
  if (!response.ok) {
    return
  }

  const manifest = await response.json()
  const entry = findManifestEntry(manifest)
  if (!entry?.file) {
    return
  }

  const baseUrl = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1)
  await Promise.all(
    (entry.css || []).map((file: string) => loadStyle(baseUrl + file))
  )
  await loadScript(baseUrl + entry.file)
}

function findManifestEntry(manifest: unknown): any {
  if (!manifest || typeof manifest !== 'object') {
    return undefined
  }

  return (
    Object.values(manifest).find((entry: any) => entry?.isEntry) ||
    Object.values(manifest).find((entry: any) =>
      String(entry?.file || '').endsWith('.js')
    )
  )
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

function loadScript(url: string) {
  return new Promise<void>((resolve) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = url
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
}
