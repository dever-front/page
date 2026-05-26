import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { NodeItemProps } from '@/page/nodes'

export type LazyNodeLoader = () => Promise<{
  default: ComponentType<NodeItemProps>
}>

export type LazyNodeComponent = LazyExoticComponent<
  ComponentType<NodeItemProps>
> & {
  preload: () => Promise<unknown>
}

export type NodeComponentRegistry = Record<string, LazyNodeComponent>

export type DeverFrontPlugin = {
  name: string
  nodes?: NodeComponentRegistry
}

export function defineFrontPlugin(plugin: DeverFrontPlugin) {
  return plugin
}

export function lazyNode(loader: LazyNodeLoader): LazyNodeComponent {
  let preloadPromise: ReturnType<LazyNodeLoader> | null = null
  const load = () => {
    if (!preloadPromise) {
      preloadPromise = loader().catch((error) => {
        preloadPromise = null
        throw error
      })
    }
    return preloadPromise
  }
  const component = lazy(load) as LazyNodeComponent
  component.preload = load
  return component
}

export function mergePluginNodes(plugins: DeverFrontPlugin[]) {
  const nodes: NodeComponentRegistry = {}

  for (const plugin of plugins) {
    Object.assign(nodes, plugin.nodes)
  }

  return nodes
}
