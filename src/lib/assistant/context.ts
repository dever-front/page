import type { Item, OptionItem, PageSchemaType, ValidateRule } from '@/lib/schema'
import { richTextDocToMarkdown } from '@/lib/rich-text'
import type { AssistantPageRegistration } from './registry'

const MAX_FIELDS = 80
const MAX_OPTIONS = 30
const MAX_VALUE_LENGTH = 2000
const SENSITIVE_PATTERN = /(password|passwd|token|secret|apikey|api_key|access_key|private_key|credential|验证码|密码|密钥|令牌)/i
const FILLABLE_NODE_TYPES = new Set([
  'form-array',
  'form-cascader',
  'form-checkbox',
  'form-combo-mapping',
  'form-date',
  'form-editor',
  'form-icon',
  'form-input',
  'form-number',
  'form-radio',
  'form-select',
  'form-switch',
  'form-textarea',
  'form-tree',
  'form-upload',
  'type-editor',
])

export type AssistantFieldContext = {
  path: string
  name: string
  type: string
  contentFormat?: 'json' | 'markdown'
  required?: boolean
  placeholder?: string
  info?: string
  options?: OptionItem[]
}

export type AssistantPageContext = {
  scope: string
  route: string
  page: {
    name?: string
    title?: string
  }
  form?: {
    fields: AssistantFieldContext[]
    values: Record<string, unknown>
  }
}

export function buildAssistantPageContext(
  registration: AssistantPageRegistration | null
): AssistantPageContext | null {
  if (!registration) {
    return null
  }
  const customContext = registration.getContext?.()
  if (customContext) {
    return customContext
  }

  const state = registration.store.getState()
  const schema = state.schema
  const fields = collectAssistantFormFields(schema)
  const values = collectAssistantFormValues(fields, state.data?.form)

  return {
    scope: registration.scope,
    route: registration.route || state.pagePath || schema.page.route || '',
    page: {
      name: schema.page.name,
      title: schema.page.title,
    },
    form: fields.length > 0 ? { fields, values } : undefined,
  }
}

export function assistantContextSummary(context: AssistantPageContext | null) {
  if (!context) {
    return '未识别到当前页面'
  }
  const pageName = context.page.name || context.page.title || context.route || '当前页面'
  const fieldCount = context.form?.fields.length || 0
  return fieldCount > 0 ? `${pageName}，${fieldCount} 个可填字段` : pageName
}

export function buildAssistantFieldContext(item: Item): AssistantFieldContext | null {
  return normalizeAssistantFormField(item)
}

export function normalizeAssistantFormPath(path: string) {
  return String(path || '')
    .trim()
    .replace(/^data\.form\./, 'form.')
    .replace(/^data\./, '')
}

function collectAssistantFormFields(schema: PageSchemaType): AssistantFieldContext[] {
  const result: AssistantFieldContext[] = []

  for (const item of Object.values(schema.nodes ?? {}).flat()) {
    if (result.length >= MAX_FIELDS) {
      break
    }
    const field = normalizeAssistantFormField(item)
    if (field) {
      result.push(field)
    }
  }

  return result
}

function normalizeAssistantFormField(item: Item): AssistantFieldContext | null {
  if (!isAssistantFillableNode(item) || item.mode !== 'form' || !item.value) {
    return null
  }
  if (isSensitiveField(item) || isHiddenField(item)) {
    return null
  }

  const path = normalizeAssistantFormPath(item.value)
  if (!path || !path.startsWith('form.')) {
    return null
  }

  const field: AssistantFieldContext = {
    path,
    name: String(item.name || item.key || item.id || path).trim(),
    type: String(item.type || '').trim(),
  }
  if (field.type === 'form-editor') {
    field.contentFormat = item.meta?.contentFormat === 'markdown' ? 'markdown' : 'json'
  }

  if (item.placeholder) {
    field.placeholder = item.placeholder
  }
  if (item.info) {
    field.info = item.info
  }
  if (isRequiredField(item.validate)) {
    field.required = true
  }
  const options = normalizeFieldOptions(item.option)
  if (options.length > 0) {
    field.options = options
  }

  return field
}

function isAssistantFillableNode(item: Item) {
  if (!FILLABLE_NODE_TYPES.has(String(item.type || ''))) {
    return false
  }
  if (item.meta?.assistant === false || item.meta?.disabled) {
    return false
  }
  return item.meta?.readonly !== true && item.meta?.readOnly !== true
}

function collectAssistantFormValues(
  fields: AssistantFieldContext[],
  form: unknown
) {
  const source = isPlainObject(form) ? form : {}
  const values: Record<string, unknown> = {}

  for (const field of fields) {
    const key = field.path.replace(/^form\./, '')
    const value = getNestedValue(source, key)
    if (value == null || value === '') {
      continue
    }
    values[field.path] = trimAssistantValue(value, field)
  }

  return values
}

function isSensitiveField(item: Item) {
  const parts = [
    item.id,
    item.key,
    item.name,
    item.value,
    item.placeholder,
    item.type,
  ]
  return parts.some((part) => SENSITIVE_PATTERN.test(String(part || '')))
}

function isHiddenField(item: Item) {
  const type = String(item.type || '').toLowerCase()
  return type.includes('hidden') || item.meta?.assistant === false
}

function isRequiredField(rules?: ValidateRule[]) {
  return rules?.some((rule) => rule.type === 'required') === true
}

function normalizeFieldOptions(option: Item['option']): OptionItem[] {
  if (!Array.isArray(option)) {
    return []
  }
  return option
    .slice(0, MAX_OPTIONS)
    .map((item) => ({
      id: item.id,
      value: item.value,
    }))
}

function trimAssistantValue(
  value: unknown,
  field?: AssistantFieldContext
): unknown {
  if (field?.type === 'form-editor' && field.contentFormat !== 'markdown') {
    const markdown = richTextDocToMarkdown(value).trim()
    if (markdown) {
      return trimAssistantText(markdown)
    }
  }
  if (typeof value === 'string') {
    return trimAssistantText(value)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => trimAssistantValue(item))
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).slice(0, 30)
    return Object.fromEntries(
      entries.map(([key, current]) => [key, trimAssistantValue(current)])
    )
  }
  return value
}

function trimAssistantText(value: string) {
  return value.length > MAX_VALUE_LENGTH
    ? `${value.slice(0, MAX_VALUE_LENGTH)}...`
    : value
}

function getNestedValue(source: Record<string, unknown>, path: string) {
  if (!path) {
    return undefined
  }
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isPlainObject(current)) {
      return undefined
    }
    return current[key]
  }, source)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
