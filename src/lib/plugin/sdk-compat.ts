import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  assistantCompatSources,
  contentCompatSources,
  directCompatSources,
  editorCompatSources,
  pageCompatSources,
  runtimeCompatSources,
  uiCompatSources,
} from './compat/sources'
import { defineFrontPlugin, lazyNode, mergePluginNodes } from './types'

type CompatModule = Record<string, any>
type CompatModuleLoader = () => Promise<unknown>
type CompatModuleGroup = {
  compatModules: Record<string, CompatModule>
}

function createCompatGroupLoaders(
  sources: Readonly<Record<string, string>>,
  loader: () => Promise<CompatModuleGroup>
) {
  let groupPromise: Promise<CompatModuleGroup> | undefined
  const loadGroup = () => {
    if (!groupPromise) {
      groupPromise = loader().catch((error) => {
        groupPromise = undefined
        throw error
      })
    }
    return groupPromise
  }

  const moduleLoaders: Record<string, CompatModuleLoader> = {}
  for (const source of Object.values(sources)) {
    moduleLoaders[source] = async () => {
      const group = await loadGroup()
      const module = group.compatModules[source]
      if (!module) {
        throw new Error(`宿主兼容模块组未注册 ${source}`)
      }
      return module
    }
  }
  return moduleLoaders
}

const compatModuleLoaders = {
  ...createCompatGroupLoaders(assistantCompatSources, () =>
    import('./compat/assistant')
  ),
  ...createCompatGroupLoaders(contentCompatSources, () =>
    import('./compat/content')
  ),
  ...createCompatGroupLoaders(editorCompatSources, () =>
    import('./compat/editor')
  ),
  ...createCompatGroupLoaders(pageCompatSources, () =>
    import('./compat/page')
  ),
  ...createCompatGroupLoaders(runtimeCompatSources, () =>
    import('./compat/runtime')
  ),
  ...createCompatGroupLoaders(uiCompatSources, () => import('./compat/ui')),
  [directCompatSources.pluginTypes]: async () => ({
    defineFrontPlugin,
    lazyNode,
    mergePluginNodes,
  }),
  [directCompatSources.pageNodes]: async () => ({}),
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
