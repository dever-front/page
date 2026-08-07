import * as formDate from '@/page/nodes/form/date'
import * as formIcon from '@/page/nodes/form/icon'
import * as formUpload from '@/page/nodes/form/upload'
import * as tableInlineEdit from '@/page/nodes/show/table/inline-edit'
import * as showTooltip from '@/page/nodes/show/tooltip'
import { pageCompatSources as source } from './sources'

export const compatModules = {
  [source.formDate]: formDate,
  [source.formIcon]: formIcon,
  [source.formUpload]: formUpload,
  [source.tableInlineEdit]: tableInlineEdit,
  [source.showTooltip]: showTooltip,
}
