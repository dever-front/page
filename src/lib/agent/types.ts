export type AgentInteractionOption = {
  id?: string | number
  label?: string
  name?: string
  value?: unknown
  native_value?: unknown
}

export type AgentInteractionField = {
  id?: string | number
  key?: string
  name?: string
  label?: string
  type?: string
  value_type?: string
  default_value?: unknown
  default?: unknown
  value?: unknown
  placeholder?: string
  required?: boolean
  upload_rule_id?: string | number
  uploadRuleId?: string | number
  max_files?: number
  multiple?: boolean
  sort?: number
  options?: AgentInteractionOption[]
}

export type AgentInteraction = {
  id?: string
  type?: string
  title?: string
  description?: string
  power?: string
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
