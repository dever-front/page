import * as confirmDialog from '@/components/confirm-dialog'
import * as siteLogo from '@/components/layout/site-logo'
import * as searchableOptionPicker from '@/components/searchable-option-picker'
import * as badge from '@/components/ui/badge'
import * as button from '@/components/ui/button'
import * as card from '@/components/ui/card'
import * as dialog from '@/components/ui/dialog'
import * as dropdownMenu from '@/components/ui/dropdown-menu'
import * as input from '@/components/ui/input'
import * as label from '@/components/ui/label'
import * as popover from '@/components/ui/popover'
import * as radioGroup from '@/components/ui/radio-group'
import * as select from '@/components/ui/select'
import * as separator from '@/components/ui/separator'
import * as sheet from '@/components/ui/sheet'
import * as switchModule from '@/components/ui/switch'
import * as table from '@/components/ui/table'
import * as textarea from '@/components/ui/textarea'
import { uiCompatSources as source } from './sources'

export const compatModules = {
  [source.confirmDialog]: confirmDialog,
  [source.siteLogo]: siteLogo,
  [source.searchableOptionPicker]: searchableOptionPicker,
  [source.badge]: badge,
  [source.button]: button,
  [source.card]: card,
  [source.dialog]: dialog,
  [source.dropdownMenu]: dropdownMenu,
  [source.input]: input,
  [source.label]: label,
  [source.popover]: popover,
  [source.radioGroup]: radioGroup,
  [source.select]: select,
  [source.separator]: separator,
  [source.sheet]: sheet,
  [source.switch]: switchModule,
  [source.table]: table,
  [source.textarea]: textarea,
}
