type OptionLike = {
  id?: string | number | null
  value?: string | null
}

export function resolveSelectedOptionLabels<T extends OptionLike>(
  options: T[],
  selectedValues: Array<string | number>
) {
  if (!Array.isArray(options) || options.length === 0 || selectedValues.length === 0) {
    return []
  }

  const optionMap = new Map(
    options.map((option) => [String(option?.id ?? ''), String(option?.value ?? '').trim()])
  )

  return selectedValues
    .map((current) => optionMap.get(String(current)) || '')
    .filter((current) => current !== '')
}
