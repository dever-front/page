import type { Item, OptionItem } from './schema'
import { getByPath, resolvePath } from './path'
import { matchConditionValue } from './condition'

type OptionFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'empty'
  | 'notEmpty'
  | 'includes'
  | 'notIncludes'

type OptionFilterRule = {
  field: string
  path: string
  operator?: OptionFilterOperator
  map?: Record<string, any>
  sourceField?: string
  sourceNodeId?: string
}

type OptionFilterContext = {
  data: Record<string, any>
  state: Record<string, any>
  optionRegistry: Record<string, OptionItem[] | undefined>
}

export function normalizeOptionFilterRules(optionFilterConfig: unknown): OptionFilterRule[] {
  if (Array.isArray(optionFilterConfig)) {
    return optionFilterConfig.filter(isOptionFilterRuleLike)
  }

  return isOptionFilterRuleLike(optionFilterConfig) ? [optionFilterConfig] : []
}

export function collectOptionFilterDependencies(item?: Pick<Item, 'meta' | 'value'>) {
  const rules = normalizeOptionFilterRules(item?.meta?.optionFilter)
  const pathValues = rules.map((rule) => String(rule.path || '').trim()).filter(Boolean)
  const sourceNodeIds = Array.from(
    new Set(
      rules
        .map((rule) => String(rule.sourceNodeId || '').trim())
        .filter(Boolean)
    )
  )

  return { rules, pathValues, sourceNodeIds }
}

export function applyOptionFilters(
  options: OptionItem[] | undefined,
  item: Pick<Item, 'meta'> | undefined,
  context: OptionFilterContext
) {
  if (!options?.length || !item) {
    return options
  }

  const rules = normalizeOptionFilterRules(item.meta?.optionFilter)
  if (!rules.length) {
    return options
  }

  const mode = item.meta?.optionFilterCondition === 'any' ? 'any' : 'all'
  return options.filter((option) => {
    const results = rules.map((rule) => matchOptionFilterRule(option, rule, context))
    return mode === 'any' ? results.some(Boolean) : results.every(Boolean)
  })
}

export function buildOptionRegistrySignature(options: OptionItem[] | undefined) {
  if (!options?.length) {
    return ''
  }

  return JSON.stringify(
    options.map((option) => ({
      id: option.id,
      value: option.value,
      meta: option,
    }))
  )
}

export function sanitizeFilteredValue(
  value: unknown,
  options: OptionItem[] | undefined,
  item?: Pick<Item, 'type' | 'meta'>
) {
  const validIDs = new Set((options || []).map((option) => String(option.id)))
  const multiple =
    item?.type === 'form-checkbox' || (item?.type === 'form-select' && item.meta?.multiple === true)

  if (multiple) {
    const currentValues = Array.isArray(value) ? value.map((item) => String(item)) : []
    const nextValues = currentValues.filter((item) => validIDs.has(item))
    return areStringArraysEqual(currentValues, nextValues) ? value : nextValues
  }

  if (value == null || value === '') {
    return value
  }

  return validIDs.has(String(value)) ? value : ''
}

function isOptionFilterRuleLike(value: unknown): value is OptionFilterRule {
  if (!value || typeof value !== 'object') {
    return false
  }

  const current = value as Record<string, any>
  return String(current.field || '').trim() !== '' && String(current.path || '').trim() !== ''
}

function matchOptionFilterRule(
  option: OptionItem,
  rule: OptionFilterRule,
  context: OptionFilterContext
) {
  const expected = resolveOptionFilterExpectedValue(rule, context)
  if (isSkippedOptionFilterValue(expected)) {
    return true
  }

  const current = getByPath(option, rule.field)
  return matchOptionFieldValue(current, expected, rule.operator)
}

function resolveOptionFilterExpectedValue(
  rule: OptionFilterRule,
  context: OptionFilterContext
) {
  const sourceValue = resolveOptionFilterSourceValue(rule, context)
  if (rule.map && typeof rule.map === 'object') {
    return resolveMappedFilterValue(sourceValue, rule.map)
  }
  return sourceValue
}

function resolveOptionFilterSourceValue(
  rule: OptionFilterRule,
  context: OptionFilterContext
) {
  const sourceValue = getScopedValue(rule.path, context.data, context.state)
  if (rule.sourceField && rule.sourceNodeId) {
    return resolveSourceFieldFilterValue(sourceValue, rule, context.optionRegistry)
  }
  return sourceValue
}

function resolveMappedFilterValue(value: unknown, mapping: Record<string, any>) {
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => mapping[String(item ?? '')])
      .filter((item) => !isSkippedOptionFilterValue(item))
    return mapped.length > 0 ? mapped : undefined
  }

  return mapping[String(value ?? '')]
}

function resolveSourceFieldFilterValue(
  value: unknown,
  rule: OptionFilterRule,
  optionRegistry: Record<string, OptionItem[] | undefined>
) {
  const sourceOptions = optionRegistry[String(rule.sourceNodeId || '').trim()] || []
  if (!sourceOptions.length) {
    return undefined
  }

  const sourceValues = normalizeFilterValueList(value)
  if (!sourceValues.length) {
    return undefined
  }

  const resolved = sourceOptions
    .filter((option) => sourceValues.includes(String(option.id)))
    .map((option) => getByPath(option, rule.sourceField!))
    .filter((item) => !isSkippedOptionFilterValue(item))

  if (!resolved.length) {
    return undefined
  }

  return Array.isArray(value) ? uniqueFilterValues(resolved) : resolved[0]
}

function matchOptionFieldValue(
  current: unknown,
  expected: unknown,
  operator?: OptionFilterOperator
) {
  if (Array.isArray(expected)) {
    if (!expected.length) {
      return true
    }
    const mode = operator ?? 'equals'
    if (mode === 'notEquals') {
      return expected.every((item) => !matchConditionValue(current, 'equals', item))
    }
    if (mode === 'notIncludes') {
      return expected.every((item) => !matchConditionValue(current, 'includes', item))
    }
    const targetOperator = mode === 'includes' ? 'includes' : 'equals'
    return expected.some((item) => matchConditionValue(current, targetOperator, item))
  }

  return matchConditionValue(current, operator ?? 'equals', expected)
}

function normalizeFilterValueList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '')).filter(Boolean)
  }

  const single = String(value ?? '').trim()
  return single ? [single] : []
}

function uniqueFilterValues(values: unknown[]) {
  return Array.from(new Set(values.map((item) => String(item ?? '')))).filter(Boolean)
}

function isSkippedOptionFilterValue(value: unknown) {
  if (value == null) {
    return true
  }
  if (typeof value === 'string') {
    return value.trim() === ''
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return false
}

function getScopedValue(
  path: string,
  data: Record<string, any>,
  state: Record<string, any>
) {
  const { scope, key } = resolvePath(path)
  return scope === 'state' ? getByPath(state, key) : getByPath(data, key)
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => item === right[index])
}
