import type { Item } from './schema'
import { getByPath } from './path'

export function inferRelationPath(valuePath?: string) {
  const path = String(valuePath || '').trim()
  if (!path) {
    return ''
  }
  if (path.endsWith('_ids')) {
    return `${path.slice(0, -4)}s`
  }
  if (path.endsWith('_id')) {
    return path.slice(0, -3)
  }
  return ''
}

export function resolveRelationLabel(value: unknown) {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['name', 'value', 'label', 'id']) {
      const nextValue = getByPath(value, key)
      if (nextValue != null && nextValue !== '') {
        return String(nextValue)
      }
    }
    return ''
  }
  return String(value)
}

export function hasMeaningfulRelationValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.some((entry) => entry != null && String(entry).trim() !== '')
  }
  return value != null && value !== ''
}

export function sanitizeRelationValue(
  relationValue: unknown,
  selectedValue: unknown,
  item?: Pick<Item, 'type' | 'meta'>
) {
  const multiple =
    item?.type === 'form-checkbox' || (item?.type === 'form-select' && item.meta?.multiple === true)
  const selectedIDs = normalizeSelectedIDs(selectedValue)

  if (multiple) {
    const currentValues = Array.isArray(relationValue) ? relationValue : []
    if (!selectedIDs.length) {
      return currentValues.length > 0 ? [] : relationValue
    }

    const nextValues = currentValues.filter((entry) =>
      selectedIDs.includes(resolveRelationEntryID(entry))
    )
    return areRelationEntriesEqual(currentValues, nextValues) ? relationValue : nextValues
  }

  if (!selectedIDs.length) {
    return relationValue == null || relationValue === '' ? relationValue : ''
  }

  return relationValue
}

function normalizeSelectedIDs(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '')).filter(Boolean)
  }

  const current = String(value ?? '').trim()
  return current ? [current] : []
}

function resolveRelationEntryID(value: unknown) {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['id', 'value', 'label', 'name']) {
      const nextValue = getByPath(value, key)
      if (nextValue != null && nextValue !== '') {
        return String(nextValue)
      }
    }
    return ''
  }
  return String(value)
}

function areRelationEntriesEqual(left: unknown[], right: unknown[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every(
    (entry, index) => resolveRelationEntryID(entry) === resolveRelationEntryID(right[index])
  )
}
