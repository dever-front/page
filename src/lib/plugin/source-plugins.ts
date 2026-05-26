import plugins from 'virtual:dever-front-plugins'
import type { DeverFrontPlugin } from './types'

export const sourcePlugins: DeverFrontPlugin[] = Array.isArray(plugins)
  ? plugins
  : []
