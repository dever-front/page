export function normalizeClearOnChangePaths(value: unknown) {
  const paths = Array.isArray(value) ? value : String(value || '').split(',')
  return Array.from(
    new Set(
      paths
        .map((path) => String(path || '').trim())
        .filter(Boolean)
    )
  )
}

export function isSameControlValue(left: unknown, right: unknown) {
  if (left === right) {
    return true
  }
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function normalizeFormRowFieldPath(
  path?: string,
  options: { allowDataForm?: boolean; allowScoped?: boolean } = {}
) {
  const value = String(path || '').trim()
  if (!value) {
    return ''
  }
  if (value.startsWith('data.form.')) {
    if (options.allowDataForm) {
      return value.slice(10)
    }
    return options.allowScoped ? value : ''
  }
  if (
    !options.allowScoped &&
    (
      value.startsWith('parent.') ||
      value.startsWith('state.') ||
      value.startsWith('data.')
    )
  ) {
    return ''
  }
  if (value === 'form') {
    return ''
  }
  if (value.startsWith('form.')) {
    return value.slice(5)
  }
  return value
}
