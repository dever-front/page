import type { Item, ValidateRule } from './schema'
import { getByPath, resolvePath } from './path'
import { CONTROL_HIDDEN_WHEN_KEY } from './page-control'

type ConditionLike = {
  path: string
  operator?:
    | 'equals'
    | 'notEquals'
    | 'empty'
    | 'notEmpty'
    | 'includes'
    | 'notIncludes'
  value?: any
}

type ParentScopeSnapshot = {
  data: Record<string, any>
  state: Record<string, any>
}

function normalizeTabValues(tabConfig: unknown) {
  if (Array.isArray(tabConfig)) {
    return tabConfig
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
  }

  const single = String(tabConfig ?? '').trim()
  return single ? [single] : []
}

function isEmptyValue(value: unknown) {
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
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  const { owner, scope, key } = resolvePath(path)
  const source =
    owner === 'parent'
      ? scope === 'state'
        ? parent?.state
        : parent?.data
      : scope === 'state'
        ? state
        : data

  return getByPath(source, key)
}

function matchesItemTab(
  item: Item,
  data: Record<string, any>,
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  const allowedTabs = normalizeTabValues(item.meta?.tab)
  if (allowedTabs.length === 0) {
    return true
  }

  const tabTarget = String(item.meta?.tabTarget || 'state.currentTab').trim()
  if (!tabTarget) {
    return true
  }

  const currentTab = String(getScopedValue(tabTarget, data, state, parent) ?? '').trim()
  if (!currentTab) {
    return true
  }

  return allowedTabs.includes(currentTab)
}

export function matchCondition(
  condition: ConditionLike,
  data: Record<string, any>,
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  const current = getScopedValue(condition.path, data, state, parent)
  return matchConditionValue(current, condition.operator ?? 'equals', condition.value)
}

export function matchConditionValue(
  current: unknown,
  operator: NonNullable<ConditionLike['operator']>,
  expected?: any
) {
  const normalized = typeof current === 'string' ? current.trim() : current
  switch (operator) {
    case 'empty':
      return isEmptyValue(normalized)
    case 'notEmpty':
      return !isEmptyValue(normalized)
    case 'includes':
      return includesConditionValue(normalized, expected)
    case 'notIncludes':
      return !includesConditionValue(normalized, expected)
    case 'notEquals':
      return String(normalized ?? '') !== String(expected ?? '')
    case 'equals':
    default:
      return String(normalized ?? '') === String(expected ?? '')
  }
}

export function evaluateConditions(
  conditions: ConditionLike[] | undefined,
  mode: 'all' | 'any',
  data: Record<string, any>,
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  if (!conditions?.length) {
    return false
  }

  const results = conditions.map((item) => matchCondition(item, data, state, parent))
  return mode === 'any' ? results.some(Boolean) : results.every(Boolean)
}

export function isItemCurrentlyHidden(
  item: Item,
  data: Record<string, any>,
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  if (!matchesItemTab(item, data, state, parent)) {
    return true
  }

  const showWhen = Array.isArray(item.meta?.showWhen) ? item.meta.showWhen : []
  const hiddenWhen = Array.isArray(item.meta?.hiddenWhen) ? item.meta.hiddenWhen : []
  const generatedHiddenWhen = Array.isArray(item.meta?.[CONTROL_HIDDEN_WHEN_KEY])
    ? item.meta[CONTROL_HIDDEN_WHEN_KEY]
    : []

  const showMatched =
    showWhen.length === 0
      ? true
      : evaluateConditions(
          showWhen,
          item.meta?.showCondition === 'any' ? 'any' : 'all',
          data,
          state,
          parent
        )

  if (!showMatched) {
    return true
  }

  const matchedByHiddenWhen = evaluateConditions(
    hiddenWhen,
    item.meta?.hiddenCondition === 'any' ? 'any' : 'all',
    data,
    state,
    parent
  )

  if (matchedByHiddenWhen) {
    return true
  }

  return evaluateConditions(generatedHiddenWhen, 'any', data, state, parent)
}

export function isItemCurrentlyReadOnly(
  item: Item,
  data: Record<string, any>,
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  if (item.meta?.readOnly === true) {
    return true
  }

  const readOnlyWhen = Array.isArray(item.meta?.readOnlyWhen)
    ? item.meta.readOnlyWhen
    : []
  return evaluateConditions(
    readOnlyWhen,
    item.meta?.readOnlyCondition === 'any' ? 'any' : 'all',
    data,
    state,
    parent
  )
}

export function shouldDisplayRequiredRule(
  rule: ValidateRule,
  data: Record<string, any>,
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  if (!rule.when?.length) {
    return true
  }

  return evaluateConditions(rule.when, rule.condition === 'any' ? 'any' : 'all', data, state, parent)
}

export function isItemCurrentlyRequired(
  item: Item,
  data: Record<string, any>,
  state: Record<string, any>,
  parent?: ParentScopeSnapshot | null
) {
  if (item.mode !== 'form' || !item.validate?.length) {
    return false
  }

  return item.validate.some(
    (rule) => rule.type === 'required' && shouldDisplayRequiredRule(rule, data, state, parent)
  )
}

function includesConditionValue(current: unknown, expected: unknown) {
  if (Array.isArray(current)) {
    return current.some((item) => String(item ?? '') === String(expected ?? ''))
  }

  return String(current ?? '').includes(String(expected ?? ''))
}
