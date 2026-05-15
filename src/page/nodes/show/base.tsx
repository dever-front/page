/**
 * Show/Base.tsx - 基础值展示
 */
import { formatDisplayValue } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'
import { resolveOptionDisplayTexts } from './option-text'

export function ShowBase({ item, value, option, store, row }: NodeItemProps) {
  const template = String(item.meta?.template || '').trim()
  if (template) {
    const text = formatDisplayValue(resolveTemplateText(template, value, store, row), item.meta?.format)
    if (!text) {
      return null
    }
    return <span>{text}</span>
  }

  if (value == null) return null
  const optionTexts = resolveOptionDisplayTexts(value, option, {
    field: String(item.meta?.field || ''),
    cases: Array.isArray(item.meta?.cases) ? item.meta.cases : [],
  })
  const separator = String(item.meta?.separator || '、')
  const displayValue = optionTexts.length > 0 ? optionTexts.join(separator) : value
  const text = formatDisplayValue(displayValue, item.meta?.format)
  if (!text) {
    return null
  }
  return <span>{text}</span>
}

function resolveTemplateText(
  template: string,
  value: unknown,
  store: NodeItemProps['store'],
  row?: Record<string, any>
) {
  const rendered = template.replace(/\{([^{}]+)\}/g, (_, rawKey: string) => {
    const key = String(rawKey || '').trim()
    if (!key) {
      return ''
    }
    if (key === 'value') {
      return stringifyTemplateValue(value)
    }
    if (key.startsWith('row.')) {
      return stringifyTemplateValue(row?.[key.slice(4)])
    }
    return stringifyTemplateValue(store.getState().getValueByPath(key))
  })
  return rendered
    .replace(/（ID：\s*0?\s*）/g, '')
    .replace(/（\s*）/g, '')
    .trim()
}

function stringifyTemplateValue(value: unknown) {
  if (value == null) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
