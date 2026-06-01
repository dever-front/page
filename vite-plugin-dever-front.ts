import { normalizePath, type PluginOption } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const virtualModuleID = 'virtual:dever-front-plugins'
const resolvedVirtualModuleID = '\0' + virtualModuleID

type DeverFrontSourcePluginOptions = {
  projectRoot: string
}

export function deverFrontSourcePlugins({
  projectRoot,
}: DeverFrontSourcePluginOptions): PluginOption {
  let enabled = false

  return {
    name: 'dever-front-source-plugins',
    configResolved() {
      enabled = process.env.VITE_DEVER_FRONT_SOURCE_PLUGINS === '1'
    },
    resolveId(id) {
      if (id === virtualModuleID) {
        return resolvedVirtualModuleID
      }
      return null
    },
    load(id) {
      if (id !== resolvedVirtualModuleID) {
        return null
      }

      const entries = enabled ? discoverFrontPlugins(projectRoot) : []
      const imports = entries
        .map((entry, index) => {
          return `import plugin${index} from ${JSON.stringify(entry)}`
        })
        .join('\n')
      const pluginList = entries.map((_, index) => `plugin${index}`).join(', ')

      return `${imports}\nexport default [${pluginList}].filter(Boolean)\n`
    },
  }
}

function discoverFrontPlugins(projectRoot: string) {
  return [
    ...discoverFrontPluginsIn(path.join(projectRoot, 'backend', 'package')),
    ...discoverFrontPluginsIn(path.join(projectRoot, 'backend', 'module')),
  ].sort()
}

function discoverFrontPluginsIn(root: string) {
  if (!fs.existsSync(root)) {
    return []
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'front', 'src', 'plugin.ts'))
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => normalizePath(entry))
}
