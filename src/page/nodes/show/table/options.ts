import type { Column } from '@/lib/schema'
import type { PageStore } from '@/lib/store'
import { getStoreValueByPath } from '@/lib/store'

export function resolveColumnOptionList(store: PageStore, column: Column) {
  const optionKey = inferOptionKey(column.value)
  const optionSource = column.meta?.option ?? (optionKey ? `option.${optionKey}` : undefined)

  if (Array.isArray(optionSource)) {
    return optionSource
  }

  if (typeof optionSource !== 'string' || !optionSource.trim()) {
    return []
  }

  const optionList = getStoreValueByPath(store, optionSource)
  return Array.isArray(optionList) ? optionList : []
}

function inferOptionKey(value?: string) {
  const field = String(value || '').trim()
  if (!field) {
    return ''
  }
  if (field.endsWith('_ids')) {
    return field.slice(0, -4)
  }
  if (field.endsWith('_id')) {
    return field.slice(0, -3)
  }
  return field
}
