export const assistantCompatSources = {
  interactionPanel: '@/components/agent/interaction-panel',
  streamRequestParams: '@/components/agent/stream-request-params',
  formActions: '@/components/assistant/form-actions',
  memoryDialog: '@/components/assistant/memory-dialog',
  referencePicker: '@/components/assistant/reference-picker',
  sessionHistoryDialog: '@/components/assistant/session-history-dialog',
  taskPopover: '@/components/assistant/task-popover',
  agentResultProtocol: '@/lib/agent-result-protocol',
  agentRunner: '@/lib/agent/runner',
  assistantContext: '@/lib/assistant/context',
  assistantReference: '@/lib/assistant/reference',
} as const

export const contentCompatSources = {
  contentView: '@/components/energon/content-view',
  progress: '@/components/energon/progress',
  referenceComposer: '@/components/reference-composer',
  richTextView: '@/components/rich-text-view',
  streamTiming: '@/components/stream-timing',
  floatingLayer: '@/lib/floating-layer',
  resource: '@/lib/resource',
  richTextHTML: '@/lib/rich-text-html',
} as const

export const editorCompatSources = {
  richTextEditor: '@/components/rich-text-editor',
} as const

export const pageCompatSources = {
  formDate: '@/page/nodes/form/date',
  formIcon: '@/page/nodes/form/icon',
  formUpload: '@/page/nodes/form/upload',
  tableInlineEdit: '@/page/nodes/show/table/inline-edit',
  showTooltip: '@/page/nodes/show/tooltip',
} as const

export const runtimeCompatSources = {
  appConfig: '@/config/app-config',
  themeProvider: '@/context/theme-provider',
  uploadRuleMetas: '@/hooks/use-upload-rule-metas',
  authRedirect: '@/lib/auth-redirect',
  icon: '@/lib/icon',
  pageDataReload: '@/lib/page-data-reload',
  pageSchemaReload: '@/lib/page-schema-reload',
  request: '@/lib/request',
  runtimeStreamOutput: '@/lib/runtime-stream-output',
  runtimeStreamRunner: '@/lib/runtime-stream-runner',
  store: '@/lib/store',
  stream: '@/lib/stream',
  upload: '@/lib/upload',
  utils: '@/lib/utils',
  authStore: '@/stores/auth-store',
} as const

export const uiCompatSources = {
  confirmDialog: '@/components/confirm-dialog',
  siteLogo: '@/components/layout/site-logo',
  searchableOptionPicker: '@/components/searchable-option-picker',
  button: '@/components/ui/button',
  card: '@/components/ui/card',
  dialog: '@/components/ui/dialog',
  dropdownMenu: '@/components/ui/dropdown-menu',
  input: '@/components/ui/input',
  radioGroup: '@/components/ui/radio-group',
  select: '@/components/ui/select',
  sheet: '@/components/ui/sheet',
  switch: '@/components/ui/switch',
  table: '@/components/ui/table',
  textarea: '@/components/ui/textarea',
} as const

export const directCompatSources = {
  pluginTypes: '@/lib/plugin/types',
  pageNodes: '@/page/nodes',
} as const
