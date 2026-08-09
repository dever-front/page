import { pageCompatSources as source } from './sources'

export const pageCompatModuleLoaders = {
  [source.formDate]: () => import('@/page/nodes/form/date'),
  [source.formIcon]: () => import('@/page/nodes/form/icon'),
  [source.formUpload]: () => import('@/page/nodes/form/upload'),
  [source.tableInlineEdit]: () => import('@/page/nodes/show/table/inline-edit'),
  [source.showTooltip]: () => import('@/page/nodes/show/tooltip'),
}
