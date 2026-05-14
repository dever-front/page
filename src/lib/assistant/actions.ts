import { toast } from 'sonner'
import type { PageStore } from '@/lib/store'
import type { AssistantPageContext } from './context'

export type AssistantFrontAction =
  | {
      type: 'fill_form'
      target: string
      value: unknown
      summary?: string
    }
  | {
      type: 'patch_form'
      values: Record<string, unknown>
      summary?: string
    }

export type AssistantActionParseResult = {
  cleanText: string
  actions: AssistantFrontAction[]
}

const FRONT_ACTION_PATTERN = /```front-action\s*([\s\S]*?)```/g

export function extractAssistantFrontActions(text: string): AssistantActionParseResult {
  const actions: AssistantFrontAction[] = []
  const cleanText = String(text || '').replace(FRONT_ACTION_PATTERN, (_, raw) => {
    const action = parseAssistantFrontAction(raw)
    if (action) {
      actions.push(action)
    }
    return ''
  }).trim()

  return { cleanText, actions }
}

export function applyAssistantFrontAction(
  store: PageStore,
  context: AssistantPageContext | null,
  action: AssistantFrontAction
) {
  const allowedPaths = new Set(
    context?.form?.fields.map((field) => normalizeActionPath(field.path)) ?? []
  )

  if (action.type === 'fill_form') {
    const target = normalizeActionPath(action.target)
    if (!isAllowedFormPath(target, allowedPaths)) {
      toast.error('AI 返回的字段不在当前表单中。')
      return false
    }
    store.getState().setValueByPath(target, action.value)
    toast.success(action.summary || '已填入字段')
    return true
  }

  let applied = 0
  for (const [path, value] of Object.entries(action.values || {})) {
    const target = normalizeActionPath(path)
    if (!isAllowedFormPath(target, allowedPaths)) {
      continue
    }
    store.getState().setValueByPath(target, value)
    applied++
  }

  if (applied === 0) {
    toast.error('AI 返回的字段不在当前表单中。')
    return false
  }
  toast.success(action.summary || `已填入 ${applied} 个字段`)
  return true
}

export function assistantActionSummary(action: AssistantFrontAction) {
  if (action.summary) {
    return action.summary
  }
  if (action.type === 'fill_form') {
    return `填入 ${action.target}`
  }
  return `填入 ${Object.keys(action.values || {}).length} 个字段`
}

export function assistantActionPreview(action: AssistantFrontAction) {
  if (action.type === 'fill_form') {
    return previewValue(action.value)
  }
  return Object.entries(action.values || {})
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${previewValue(value)}`)
    .join('\n')
}

function parseAssistantFrontAction(raw: string): AssistantFrontAction | null {
  try {
    const parsed = JSON.parse(String(raw || '').trim())
    return normalizeAssistantFrontAction(parsed)
  } catch {
    return null
  }
}

function normalizeAssistantFrontAction(value: unknown): AssistantFrontAction | null {
  if (!isPlainObject(value)) {
    return null
  }
  const type = String(value.type || '').trim()
  if (type === 'fill_form') {
    const target = normalizeActionPath(String(value.target || ''))
    if (!target) {
      return null
    }
    return {
      type,
      target,
      value: value.value,
      summary: String(value.summary || '').trim() || undefined,
    }
  }
  if (type === 'patch_form' && isPlainObject(value.values)) {
    return {
      type,
      values: value.values,
      summary: String(value.summary || '').trim() || undefined,
    }
  }
  return null
}

function isAllowedFormPath(path: string, allowedPaths: Set<string>) {
  return path.startsWith('form.') && allowedPaths.has(path)
}

function normalizeActionPath(path: string) {
  return String(path || '')
    .trim()
    .replace(/^data\.form\./, 'form.')
    .replace(/^data\./, '')
}

function previewValue(value: unknown) {
  const text =
    typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 2) ?? String(value ?? '')
  return text.length > 600 ? `${text.slice(0, 600)}...` : text
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
