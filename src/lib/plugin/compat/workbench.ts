import { compatModules as assistantModules } from './assistant'
import { compatModules as contentModules } from './content'

export const compatModules = {
  ...assistantModules,
  ...contentModules,
}
