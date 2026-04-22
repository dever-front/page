import type { Item, PageSchemaType } from './schema'

export const CONTROL_HIDDEN_WHEN_KEY = '__controlHiddenWhen'

type ControlOperator =
  | 'equals'
  | 'notEquals'
  | 'empty'
  | 'notEmpty'
  | 'includes'
  | 'notIncludes'

type ControlRule = {
  operator?: ControlOperator
  value?: any
  hide?: string | string[]
}

type ControlCondition = {
  path: string
  operator?: ControlOperator
  value?: any
}

export function applyPageControlRules(schema: PageSchemaType): PageSchemaType {
  const items = Object.values(schema.nodes ?? {}).flat()
  clearGeneratedControlMeta(items)

  const itemById = new Map<string, Item>()
  for (const item of items) {
    if (item.id) {
      itemById.set(String(item.id), item)
    }
  }

  for (const item of items) {
    const rules = normalizeControlRules(item.meta?.control)
    if (!rules.length || !item.value) {
      continue
    }

    for (const rule of rules) {
      const targetIds = normalizeControlTargetIds(rule.hide)
      if (!targetIds.length) {
        continue
      }

      const condition = buildControlCondition(item, rule)
      for (const targetId of targetIds) {
        const targetItem = itemById.get(targetId)
        if (!targetItem) {
          continue
        }
        appendGeneratedHiddenCondition(targetItem, condition)
      }
    }
  }

  return schema
}

function clearGeneratedControlMeta(items: Item[]) {
  for (const item of items) {
    if (!item.meta || typeof item.meta !== 'object') {
      continue
    }

    delete item.meta[CONTROL_HIDDEN_WHEN_KEY]
  }
}

function normalizeControlRules(controlConfig: unknown): ControlRule[] {
  if (Array.isArray(controlConfig)) {
    return controlConfig.filter(isControlRuleLike)
  }

  return isControlRuleLike(controlConfig) ? [controlConfig] : []
}

function isControlRuleLike(value: unknown): value is ControlRule {
  return !!value && typeof value === 'object'
}

function normalizeControlTargetIds(targets: unknown) {
  if (Array.isArray(targets)) {
    return Array.from(
      new Set(
        targets
          .map((item) => String(item ?? '').trim())
          .filter(Boolean)
      )
    )
  }

  const single = String(targets ?? '').trim()
  return single ? [single] : []
}

function buildControlCondition(item: Item, rule: ControlRule): ControlCondition {
  return {
    path: item.value!,
    operator: rule.operator ?? resolveDefaultControlOperator(item),
    value: rule.value,
  }
}

function resolveDefaultControlOperator(item: Item): ControlOperator {
  if (item.type === 'form-checkbox') {
    return 'includes'
  }

  if (item.type === 'form-select' && item.meta?.multiple === true) {
    return 'includes'
  }

  return 'equals'
}

function appendGeneratedHiddenCondition(item: Item, condition: ControlCondition) {
  const meta = item.meta ?? {}
  const current = Array.isArray(meta[CONTROL_HIDDEN_WHEN_KEY])
    ? (meta[CONTROL_HIDDEN_WHEN_KEY] as ControlCondition[])
    : []

  item.meta = {
    ...meta,
    [CONTROL_HIDDEN_WHEN_KEY]: [...current, condition],
  }
}
