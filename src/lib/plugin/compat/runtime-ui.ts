import { compatModules as runtimeModules } from './runtime'
import { compatModules as uiModules } from './ui'

export const compatModules = {
  ...runtimeModules,
  ...uiModules,
}
