import * as showTooltip from '@/page/nodes/show/tooltip'
import { pageCompatSources as source } from './sources'

const loadForm = () => import('@/page/nodes/groups/form')
const loadDataEditor = () => import('@/page/nodes/groups/data-editor')

export const pageCompatModuleLoaders = {
  [source.formDate]: loadForm,
  [source.formIcon]: loadForm,
  [source.formUpload]: loadForm,
  [source.tableInlineEdit]: loadDataEditor,
  [source.showTooltip]: async () => showTooltip,
}
