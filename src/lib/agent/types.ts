export type AgentInteractionOption = {
  id?: string | number
  label?: string
  name?: string
  value?: unknown
  native_value?: unknown
}

export type AgentInteractionField = {
  id?: string | number
  power_param_id?: string | number
  powerParamId?: string | number
  key?: string
  name?: string
  label?: string
  icon?: string
  type?: string
  preview_type?: string
  previewType?: string
  usage?: number
  value_type?: string
  valueType?: string
  default_value?: unknown
  defaultValue?: unknown
  default?: unknown
  value?: unknown
  placeholder?: string
  active_when_key?: string
  activeWhenKey?: string
  active_when_value?: string
  activeWhenValue?: string
  required?: boolean
  upload_rule_id?: string | number
  uploadRuleId?: string | number
  max_files?: number
  maxFiles?: number
  accepted_kinds?: string[]
  acceptedKinds?: string[]
  asset_kinds?: string[]
  assetKinds?: string[]
  multiple?: boolean
  sort?: number
  options?: AgentInteractionOption[]
  option?: unknown
  choices?: unknown
  items?: unknown
  enums?: unknown
  recommended?: unknown[]
}

export type AgentInteraction = {
  id?: string
  type?: string
  title?: string
  description?: string
  presentation?: string
  power?: string
  source_target_id?: string | number
  sourceTargetId?: string | number
  fields?: AgentInteractionField[]
  values?: Record<string, unknown>
  default_values?: Record<string, unknown>
  data?: Record<string, unknown>
  input?: Record<string, unknown>
  params?: Record<string, unknown>
  arguments?: Record<string, unknown>
}

export type AgentInteractionSubmitResult = {
  text: string
  data: Record<string, unknown>
}
