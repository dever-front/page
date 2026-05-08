import { getByPath } from '@/lib/path'
import type { OptionItem } from '@/lib/schema'

type DisplayCase = {
  value?: unknown
  text?: unknown
  label?: unknown
  name?: unknown
}

type DisplayOption = OptionItem & {
  label?: string
  name?: string
}

export function resolveOptionDisplayTexts(
  value: unknown,
  option: OptionItem[] | undefined,
  config: {
    field?: string
    cases?: DisplayCase[]
  } = {}
) {
  if (Array.isArray(value)) {
    return value
      .map((current) => resolveSingleOptionText(current, option, config))
      .filter((current): current is string => !!current)
  }

  const single = resolveSingleOptionText(value, option, config)
  return single ? [single] : []
}

function resolveSingleOptionText(
  value: unknown,
  option: OptionItem[] | undefined,
  config: {
    field?: string
    cases?: DisplayCase[]
  }
) {
  if (value == null || value === '') {
    return ''
  }

  if (typeof value === 'object') {
    return resolveObjectText(value as Record<string, unknown>, config.field)
  }

  const optionText = resolveOptionText(value, option)
  if (optionText) {
    return optionText
  }

  const caseText = resolveCaseText(value, config.cases)
  if (caseText) {
    return caseText
  }

  return String(value)
}

function resolveObjectText(value: Record<string, unknown>, field?: string) {
  const fieldPath = String(field || '').trim()
  if (fieldPath) {
    const fieldValue = getByPath(value, fieldPath)
    if (fieldValue != null && fieldValue !== '') {
      return String(fieldValue)
    }
  }

  for (const key of ['label', 'value', 'name', 'id']) {
    if (value[key] != null && value[key] !== '') {
      return String(value[key])
    }
  }
  return ''
}

function resolveOptionText(value: unknown, option: OptionItem[] | undefined) {
  if (!Array.isArray(option)) {
    return ''
  }

  const found = option.find((current) => String(current.id) === String(value)) as
    | DisplayOption
    | undefined
  if (!found) {
    return ''
  }

  return String(found.label ?? found.value ?? found.name ?? '').trim()
}

function resolveCaseText(value: unknown, cases: DisplayCase[] | undefined) {
  if (!Array.isArray(cases)) {
    return ''
  }

  const matchedCase = cases.find(
    (current) => String(current?.value ?? '') === String(value)
  )
  return String(
    matchedCase?.text ?? matchedCase?.label ?? matchedCase?.name ?? ''
  ).trim()
}
