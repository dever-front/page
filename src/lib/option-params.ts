import { getByPath, resolvePath } from './path'
import type { PageStore } from './store'

type OptionParamContext = {
  store: PageStore
  row?: Record<string, any>
}

export function collectOptionParamPaths(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  return Object.values(value)
    .map((item) => String(item ?? '').trim())
    .filter(isDynamicPath)
}

export function resolveOptionParams(
  value: unknown,
  context: OptionParamContext
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const result: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) {
      continue
    }

    const resolvedValue = resolveOptionParamValue(rawValue, context)
    if (resolvedValue == null || String(resolvedValue).trim() === '') {
      continue
    }
    result[normalizedKey] = String(resolvedValue)
  }

  return result
}

function resolveOptionParamValue(value: unknown, context: OptionParamContext) {
  const text = String(value ?? '').trim()
  if (!isDynamicPath(text)) {
    return value
  }

  if (text.startsWith('row.')) {
    return getByPath(context.row, text.slice(4))
  }

  const { owner, scope, key } = resolvePath(text)
  const targetStore =
    owner === 'parent'
      ? context.store.getState().parentStore ?? context.store
      : context.store
  const state = targetStore.getState()
  return scope === 'state' ? getByPath(state.state, key) : getByPath(state.data, key)
}

function isDynamicPath(value: string) {
  return (
    value.startsWith('row.') ||
    value.startsWith('form.') ||
    value.startsWith('option.') ||
    value.startsWith('data.') ||
    value.startsWith('state.') ||
    value.startsWith('parent.data.') ||
    value.startsWith('parent.state.')
  )
}
