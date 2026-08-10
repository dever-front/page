import * as showTooltip from '@/page/nodes/show/tooltip'
import { pageCompatSources as source } from './sources'

const loadFormPicker = () => import('@/page/nodes/groups/form-picker')
const loadShowTable = () => import('@/page/nodes/show/table')

export const pageCompatModuleLoaders = {
  [source.formDate]: loadFormPicker,
  [source.formIcon]: loadFormPicker,
  [source.formUpload]: loadFormPicker,
  [source.tableInlineEdit]: loadShowTable,
  [source.showTooltip]: async () => showTooltip,
}
