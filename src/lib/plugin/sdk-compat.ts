import { useNavigate, useSearch } from '@tanstack/react-router'
import { defineFrontPlugin, lazyNode, mergePluginNodes } from './types'

type CompatModule = Record<string, any>
type CompatModuleLoader = () => Promise<unknown>

const compatModuleLoaders = {
  '@/components/agent/interaction-panel': () =>
    import('@/components/agent/interaction-panel'),
  '@/components/agent/stream-request-params': () =>
    import('@/components/agent/stream-request-params'),
  '@/components/assistant/form-actions': () =>
    import('@/components/assistant/form-actions'),
  '@/components/assistant/memory-dialog': () =>
    import('@/components/assistant/memory-dialog'),
  '@/components/assistant/reference-picker': () =>
    import('@/components/assistant/reference-picker'),
  '@/components/assistant/session-history-dialog': () =>
    import('@/components/assistant/session-history-dialog'),
  '@/components/assistant/task-popover': () =>
    import('@/components/assistant/task-popover'),
  '@/components/confirm-dialog': () => import('@/components/confirm-dialog'),
  '@/components/energon/content-view': () =>
    import('@/components/energon/content-view'),
  '@/components/energon/progress': () =>
    import('@/components/energon/progress'),
  '@/components/layout/site-logo': () =>
    import('@/components/layout/site-logo'),
  '@/components/reference-composer': () =>
    import('@/components/reference-composer'),
  '@/components/rich-text-editor': () =>
    import('@/components/rich-text-editor'),
  '@/components/rich-text-view': () => import('@/components/rich-text-view'),
  '@/components/searchable-option-picker': () =>
    import('@/components/searchable-option-picker'),
  '@/components/stream-timing': () => import('@/components/stream-timing'),
  '@/components/ui/button': () => import('@/components/ui/button'),
  '@/components/ui/card': () => import('@/components/ui/card'),
  '@/components/ui/dialog': () => import('@/components/ui/dialog'),
  '@/components/ui/dropdown-menu': () =>
    import('@/components/ui/dropdown-menu'),
  '@/components/ui/input': () => import('@/components/ui/input'),
  '@/components/ui/radio-group': () => import('@/components/ui/radio-group'),
  '@/components/ui/select': () => import('@/components/ui/select'),
  '@/components/ui/sheet': () => import('@/components/ui/sheet'),
  '@/components/ui/switch': () => import('@/components/ui/switch'),
  '@/components/ui/table': () => import('@/components/ui/table'),
  '@/components/ui/textarea': () => import('@/components/ui/textarea'),
  '@/config/app-config': () =>
    import('@/config/app-config').then(({ getSiteConfig }) => ({ getSiteConfig })),
  '@/context/theme-provider': () => import('@/context/theme-provider'),
  '@/hooks/use-upload-rule-metas': () =>
    import('@/hooks/use-upload-rule-metas'),
  '@/lib/agent-result-protocol': () => import('@/lib/agent-result-protocol'),
  '@/lib/agent/runner': () => import('@/lib/agent/runner'),
  '@/lib/assistant/context': () => import('@/lib/assistant/context'),
  '@/lib/assistant/reference': () => import('@/lib/assistant/reference'),
  '@/lib/auth-redirect': () => import('@/lib/auth-redirect'),
  '@/lib/floating-layer': () => import('@/lib/floating-layer'),
  '@/lib/icon': () => import('@/lib/icon'),
  '@/lib/page-data-reload': () => import('@/lib/page-data-reload'),
  '@/lib/page-schema-reload': () => import('@/lib/page-schema-reload'),
  '@/lib/plugin/types': async () => ({
    defineFrontPlugin,
    lazyNode,
    mergePluginNodes,
  }),
  '@/lib/request': () => import('@/lib/request'),
  '@/lib/resource': () => import('@/lib/resource'),
  '@/lib/rich-text-html': () => import('@/lib/rich-text-html'),
  '@/lib/runtime-stream-output': () => import('@/lib/runtime-stream-output'),
  '@/lib/runtime-stream-runner': () => import('@/lib/runtime-stream-runner'),
  '@/lib/store': () => import('@/lib/store'),
  '@/lib/stream': () => import('@/lib/stream'),
  '@/lib/upload': () => import('@/lib/upload'),
  '@/lib/utils': () => import('@/lib/utils'),
  '@/page/nodes/form/date': () => import('@/page/nodes/form/date'),
  '@/page/nodes/form/icon': () => import('@/page/nodes/form/icon'),
  '@/page/nodes/form/upload': () => import('@/page/nodes/form/upload'),
  '@/page/nodes/show/table/inline-edit': () =>
    import('@/page/nodes/show/table/inline-edit'),
  '@/page/nodes/show/tooltip': () => import('@/page/nodes/show/tooltip'),
  '@/page/nodes': async () => ({}),
  '@/stores/auth-store': () => import('@/stores/auth-store'),
} satisfies Record<string, CompatModuleLoader>

const compatModules = new Map<string, CompatModule>()
const loadingCompatModules = new Map<string, Promise<void>>()

export type FrontPluginSDK = {
  defineFrontPlugin: typeof defineFrontPlugin
  lazyNode: typeof lazyNode
  mergePluginNodes: typeof mergePluginNodes
  useNavigate: typeof useNavigate
  useSearch: typeof useSearch
  getCompatModule: (path: string) => CompatModule
}

export function createFrontPluginSDK(): FrontPluginSDK {
  return {
    defineFrontPlugin,
    lazyNode,
    mergePluginNodes,
    useNavigate,
    useSearch,
    getCompatModule(path) {
      return compatModules.get(normalizeCompatSource(path)) || {}
    },
  }
}

export async function ensureCompatModules(sources?: string[]) {
  // Legacy manifests have no dependency metadata and must retain the old
  // load-all behavior. An explicit empty list means the plugin needs none.
  const targets =
    sources === undefined
      ? Object.keys(compatModuleLoaders)
      : uniqueCompatSources(sources)
  await Promise.all(targets.map(ensureCompatModule))
}

async function ensureCompatModule(source: string) {
  const normalizedSource = normalizeCompatSource(source)
  if (compatModules.has(normalizedSource)) {
    return
  }

  const existing = loadingCompatModules.get(normalizedSource)
  if (existing) {
    await existing
    return
  }

  const loader = compatModuleLoaders[
    normalizedSource as keyof typeof compatModuleLoaders
  ]
  if (!loader) {
    throw new Error(`宿主未注册兼容模块 ${normalizedSource}`)
  }

  const loading = loader().then((module) => {
    compatModules.set(normalizedSource, module as CompatModule)
  })
  loadingCompatModules.set(normalizedSource, loading)
  try {
    await loading
  } finally {
    if (loadingCompatModules.get(normalizedSource) === loading) {
      loadingCompatModules.delete(normalizedSource)
    }
  }
}

function uniqueCompatSources(sources: string[]) {
  return Array.from(new Set(sources.map(normalizeCompatSource).filter(Boolean)))
}

function normalizeCompatSource(source: string) {
  return String(source || '').trim()
}
