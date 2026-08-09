import { uiCompatSources as source } from './sources'

export const uiCompatModuleLoaders = {
  [source.confirmDialog]: () => import('@/components/confirm-dialog'),
  [source.siteLogo]: () => import('@/components/layout/site-logo'),
  [source.searchableOptionPicker]: () =>
    import('@/components/searchable-option-picker'),
  [source.button]: () => import('@/components/ui/button'),
  [source.card]: () => import('@/components/ui/card'),
  [source.dialog]: () => import('@/components/ui/dialog'),
  [source.dropdownMenu]: () => import('@/components/ui/dropdown-menu'),
  [source.input]: () => import('@/components/ui/input'),
  [source.radioGroup]: () => import('@/components/ui/radio-group'),
  [source.select]: () => import('@/components/ui/select'),
  [source.sheet]: () => import('@/components/ui/sheet'),
  [source.switch]: () => import('@/components/ui/switch'),
  [source.table]: () => import('@/components/ui/table'),
  [source.textarea]: () => import('@/components/ui/textarea'),
}
