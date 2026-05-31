import { useNavigate, useSearch } from '@tanstack/react-router'
import { getRuntimeConfig, getSiteConfig } from '@/config/app-config'
import * as authStoreModule from '@/stores/auth-store'
import * as agentResultProtocolModule from '@/lib/agent-result-protocol'
import * as agentRunnerModule from '@/lib/agent/runner'
import * as assistantContextModule from '@/lib/assistant/context'
import * as assistantReferenceModule from '@/lib/assistant/reference'
import * as authRedirectModule from '@/lib/auth-redirect'
import * as pageSchemaReloadModule from '@/lib/page-schema-reload'
import * as requestModule from '@/lib/request'
import * as resourceModule from '@/lib/resource'
import * as runtimeStreamOutputModule from '@/lib/runtime-stream-output'
import * as runtimeStreamRunnerModule from '@/lib/runtime-stream-runner'
import * as storeModule from '@/lib/store'
import * as streamModule from '@/lib/stream'
import * as utilsModule from '@/lib/utils'
import * as uploadRuleMetasModule from '@/hooks/use-upload-rule-metas'
import { Button, buttonVariants } from '@/components/ui/button'
import * as cardModule from '@/components/ui/card'
import * as dialogModule from '@/components/ui/dialog'
import * as inputModule from '@/components/ui/input'
import * as radioGroupModule from '@/components/ui/radio-group'
import * as selectModule from '@/components/ui/select'
import * as sheetModule from '@/components/ui/sheet'
import * as textareaModule from '@/components/ui/textarea'
import * as agentInteractionPanelModule from '@/components/agent/interaction-panel'
import * as agentStreamRequestParamsModule from '@/components/agent/stream-request-params'
import * as assistantFormActionsModule from '@/components/assistant/form-actions'
import * as assistantReferencePickerModule from '@/components/assistant/reference-picker'
import * as assistantTaskPopoverModule from '@/components/assistant/task-popover'
import * as confirmDialogModule from '@/components/confirm-dialog'
import * as energonContentViewModule from '@/components/energon/content-view'
import * as energonProgressModule from '@/components/energon/progress'
import * as siteLogoModule from '@/components/layout/site-logo'
import * as searchableOptionPickerModule from '@/components/searchable-option-picker'
import * as streamTimingModule from '@/components/stream-timing'
import {
  defineFrontPlugin,
  lazyNode,
  mergePluginNodes,
  type DeverFrontPlugin,
  type NodeComponentRegistry,
} from './types'

const GLOBAL_KEY = 'DeverFront'

type FrontPluginRuntimeGlobal = {
  registerPlugin: (plugin: DeverFrontPlugin) => void
  sdk: FrontPluginSDK
}

type FrontPluginSDK = {
  defineFrontPlugin: typeof defineFrontPlugin
  lazyNode: typeof lazyNode
  mergePluginNodes: typeof mergePluginNodes
  useNavigate: typeof useNavigate
  useSearch: typeof useSearch
  getCompatModule: (path: string) => Record<string, any>
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
    sdk: createFrontPluginSDK(),
  }
}

function createFrontPluginSDK(): FrontPluginSDK {
  const modules = createCompatModules()
  return {
    defineFrontPlugin,
    lazyNode,
    mergePluginNodes,
    useNavigate,
    useSearch,
    getCompatModule(path) {
      return modules[path] || {}
    },
  }
}

function createCompatModules(): Record<string, Record<string, any>> {
  return {
    '@/components/agent/interaction-panel': agentInteractionPanelModule,
    '@/components/agent/stream-request-params': agentStreamRequestParamsModule,
    '@/components/assistant/form-actions': assistantFormActionsModule,
    '@/components/assistant/reference-picker': assistantReferencePickerModule,
    '@/components/assistant/task-popover': assistantTaskPopoverModule,
    '@/components/confirm-dialog': confirmDialogModule,
    '@/components/energon/content-view': energonContentViewModule,
    '@/components/energon/progress': energonProgressModule,
    '@/components/layout/site-logo': siteLogoModule,
    '@/components/searchable-option-picker': searchableOptionPickerModule,
    '@/components/stream-timing': streamTimingModule,
    '@/components/ui/button': { Button, buttonVariants },
    '@/components/ui/card': cardModule,
    '@/components/ui/dialog': dialogModule,
    '@/components/ui/input': inputModule,
    '@/components/ui/radio-group': radioGroupModule,
    '@/components/ui/select': selectModule,
    '@/components/ui/sheet': sheetModule,
    '@/components/ui/textarea': textareaModule,
    '@/config/app-config': { getSiteConfig },
    '@/hooks/use-upload-rule-metas': uploadRuleMetasModule,
    '@/lib/agent-result-protocol': agentResultProtocolModule,
    '@/lib/agent/runner': agentRunnerModule,
    '@/lib/assistant/context': assistantContextModule,
    '@/lib/assistant/reference': assistantReferenceModule,
    '@/lib/auth-redirect': authRedirectModule,
    '@/lib/page-schema-reload': pageSchemaReloadModule,
    '@/lib/plugin/types': {
      defineFrontPlugin,
      lazyNode,
      mergePluginNodes,
    },
    '@/lib/request': requestModule,
    '@/lib/resource': resourceModule,
    '@/lib/runtime-stream-output': runtimeStreamOutputModule,
    '@/lib/runtime-stream-runner': runtimeStreamRunnerModule,
    '@/lib/store': storeModule,
    '@/lib/stream': streamModule,
    '@/lib/utils': utilsModule,
    '@/page/nodes': {},
    '@/stores/auth-store': authStoreModule,
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
    (entry.css || []).map((file: string) =>
      loadStyle(resolveManifestAsset(baseUrl, file))
    )
  )
  await loadScript(resolveManifestAsset(baseUrl, entry.file), !!entry.module)
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

function resolveManifestAsset(baseUrl: string, file: string) {
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
