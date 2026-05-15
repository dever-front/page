import { toast } from 'sonner'
import type { PageStore } from '@/lib/store'
import {
  applyAssistantFrontAction,
  extractAssistantFrontActions,
  normalizeAssistantActionPath,
  type AssistantFrontAction,
} from './actions'
import {
  buildAssistantPageContext,
  type AssistantFieldContext,
  type AssistantPageContext,
} from './context'
import { runAssistantAgent, type AssistantStatusHandler } from './client'
import type { AssistantPageRegistration, AssistantPageScope } from './registry'
import { loadAssistantPermissionContextSafe } from './permission'
import {
  buildAssistantReferenceSummary,
  type AssistantReferenceFile,
} from './reference'
import {
  buildAssistantFormFillTask,
  type AssistantFormTaskMode,
} from './task'

type AssistantQuickFillMode = AssistantFormTaskMode

export type AssistantQuickFillOptions = {
  store: PageStore
  scope?: AssistantPageScope
  route?: string
  field?: AssistantFieldContext
  instruction?: string
  sourceText?: string
  references?: AssistantReferenceFile[]
  overwrite?: boolean
  signal?: AbortSignal
  onStatus?: AssistantStatusHandler
}

export type AssistantQuickFillResult = {
  applied: boolean
  text: string
}

export type AssistantContextQuickFillOptions = {
  context: AssistantPageContext
  field?: AssistantFieldContext
  instruction?: string
  sourceText?: string
  references?: AssistantReferenceFile[]
  overwrite?: boolean
  signal?: AbortSignal
  onStatus?: AssistantStatusHandler
  onApplyField?: (path: string, value: unknown) => void | Promise<void>
  onApplyValues?: (values: Record<string, unknown>) => void | Promise<void>
}

export async function runAssistantQuickFill({
  store,
  scope = 'modal',
  route,
  field,
  instruction,
  sourceText,
  references,
  overwrite = false,
  signal,
  onStatus,
}: AssistantQuickFillOptions): Promise<AssistantQuickFillResult> {
  const registration = buildQuickFillRegistration(store, scope, route)
  const context = buildAssistantPageContext(registration)
  const mode = resolveQuickFillMode(field, sourceText)

  if (!context?.form?.fields.length) {
    toast.error('当前页面没有可由 AI 填写的表单字段。')
    return { applied: false, text: '' }
  }

  if (field && !context.form.fields.some((item) => sameFieldPath(item.path, field.path))) {
    toast.error('当前字段不在可填写表单范围内。')
    return { applied: false, text: '' }
  }

  onStatus?.('正在请求 AI 填写')
  const permissionContext = await loadAssistantPermissionContextSafe()
  if (signal?.aborted) {
    return { applied: false, text: '' }
  }
  const finalText = await runAssistantAgent({
    text: buildQuickFillUserText(mode, field, sourceText, instruction, references),
    task: buildAssistantFormFillTask({
      mode,
      field,
      sourceText,
      instruction,
      references,
      overwrite,
    }),
    context,
    permissionContext,
    history: [],
    signal,
    onStatus,
  })
  if (signal?.aborted) {
    return { applied: false, text: finalText }
  }
  const parsed = extractAssistantFrontActions(finalText)
  const actions = filterQuickFillActions(parsed.actions, field)

  if (actions.length === 0 && field) {
    const fallbackText = cleanFieldText(parsed.cleanText || finalText)
    if (fallbackText) {
      store.getState().setValueByPath(field.path, fallbackText)
      toast.success(`已生成${field.name}`)
      return { applied: true, text: fallbackText }
    }
  }

  let applied = false
  for (const action of actions) {
    const ok = await applyAssistantFrontAction(
      {
        registration,
        context,
        permissionContext,
        navigate: () => false,
      },
      action
    )
    applied = applied || ok
  }

  if (!applied) {
    toast.error('AI 没有返回可填入当前表单的内容。')
  }

  return {
    applied,
    text: parsed.cleanText || finalText,
  }
}

export async function runAssistantContextQuickFill({
  context,
  field,
  instruction,
  sourceText,
  references,
  overwrite = false,
  signal,
  onStatus,
  onApplyField,
  onApplyValues,
}: AssistantContextQuickFillOptions): Promise<AssistantQuickFillResult> {
  const mode = resolveQuickFillMode(field, sourceText)

  if (!context?.form?.fields.length) {
    toast.error('当前页面没有可由 AI 填写的表单字段。')
    return { applied: false, text: '' }
  }

  if (field && !context.form.fields.some((item) => sameFieldPath(item.path, field.path))) {
    toast.error('当前字段不在可填写表单范围内。')
    return { applied: false, text: '' }
  }

  onStatus?.('正在请求 AI 填写')
  const permissionContext = await loadAssistantPermissionContextSafe()
  if (signal?.aborted) {
    return { applied: false, text: '' }
  }
  const finalText = await runAssistantAgent({
    text: buildQuickFillUserText(mode, field, sourceText, instruction, references),
    task: buildAssistantFormFillTask({
      mode,
      field,
      sourceText,
      instruction,
      references,
      overwrite,
    }),
    context,
    permissionContext,
    history: [],
    signal,
    onStatus,
  })
  if (signal?.aborted) {
    return { applied: false, text: finalText }
  }
  const parsed = extractAssistantFrontActions(finalText)
  const actions = filterQuickFillActions(parsed.actions, field)

  if (actions.length === 0 && field) {
    const fallbackText = cleanFieldText(parsed.cleanText || finalText)
    if (fallbackText) {
      await onApplyField?.(field.path, fallbackText)
      toast.success(`已生成${field.name}`)
      return { applied: true, text: fallbackText }
    }
  }

  let applied = false
  for (const action of actions) {
    if (action.type === 'fill_form') {
      if (onApplyField) {
        await onApplyField(action.target, action.value)
        applied = true
      } else if (onApplyValues) {
        await onApplyValues({ [normalizeAssistantActionPath(action.target)]: action.value })
        applied = true
      }
      continue
    }
    if (action.type === 'patch_form') {
      const values = filterPatchValues(action.values, context.form.fields)
      if (onApplyValues) {
        await onApplyValues(values)
        applied = Object.keys(values).length > 0
      } else if (onApplyField) {
        for (const [path, value] of Object.entries(values)) {
          await onApplyField(path, value)
          applied = true
        }
      }
    }
  }

  if (!applied) {
    toast.error('AI 没有返回可填入当前表单的内容。')
  }

  return {
    applied,
    text: parsed.cleanText || finalText,
  }
}

function buildQuickFillRegistration(
  store: PageStore,
  scope: AssistantPageScope,
  route?: string
): AssistantPageRegistration {
  const state = store.getState()
  return {
    id: 'assistant-quick-fill',
    store,
    scope,
    route: route || state.pagePath || state.schema.page.route || '',
  }
}

function resolveQuickFillMode(
  field?: AssistantFieldContext,
  sourceText?: string
): AssistantQuickFillMode {
  if (field) {
    return 'field'
  }
  return String(sourceText || '').trim() ? 'paste' : 'form'
}

function buildQuickFillUserText(
  mode: AssistantQuickFillMode,
  field?: AssistantFieldContext,
  sourceText?: string,
  instruction?: string,
  references?: AssistantReferenceFile[]
) {
  const parts: string[] = []
  if (mode === 'field' && field) {
    parts.push(`请只生成并填入字段：${field.name}（${field.path}）。`)
  } else if (mode === 'paste') {
    parts.push(`请解析下面内容并填入当前表单：\n${String(sourceText || '').trim()}`)
  } else {
    parts.push('请根据当前表单上下文补全当前表单。')
  }

  const userInstruction = String(instruction || '').trim()
  if (userInstruction) {
    parts.push(`补充信息：\n${userInstruction}`)
  }

  const referenceSummary = buildAssistantReferenceSummary(references)
  if (referenceSummary) {
    parts.push(referenceSummary)
  }

  return parts.join('\n\n')
}

function filterQuickFillActions(
  actions: AssistantFrontAction[],
  field?: AssistantFieldContext
): AssistantFrontAction[] {
  if (!field) {
    return actions.filter(isFormFillAction)
  }

  const fieldPath = normalizeAssistantActionPath(field.path)
  const result: AssistantFrontAction[] = []
  for (const action of actions) {
    if (action.type === 'fill_form') {
      if (sameFieldPath(action.target, fieldPath)) {
        result.push({
          ...action,
          target: fieldPath,
          summary: action.summary || `已生成${field.name}`,
        })
      }
      continue
    }

    if (action.type === 'patch_form') {
      const value = findPatchValue(action.values, fieldPath)
      if (value.exists) {
        result.push({
          type: 'fill_form',
          target: fieldPath,
          value: value.value,
          summary: action.summary || `已生成${field.name}`,
        })
      }
    }
  }
  return result
}

function isFormFillAction(
  action: AssistantFrontAction
): action is Extract<AssistantFrontAction, { type: 'fill_form' | 'patch_form' }> {
  return action.type === 'fill_form' || action.type === 'patch_form'
}

function findPatchValue(values: Record<string, unknown>, targetPath: string) {
  for (const [path, value] of Object.entries(values || {})) {
    if (sameFieldPath(path, targetPath)) {
      return { exists: true, value }
    }
  }
  return { exists: false, value: undefined }
}

function filterPatchValues(
  values: Record<string, unknown>,
  fields: AssistantFieldContext[]
) {
  const allowedPaths = new Map(
    fields.map((field) => [normalizeAssistantActionPath(field.path), field.path])
  )
  const result: Record<string, unknown> = {}

  for (const [path, value] of Object.entries(values || {})) {
    const targetPath = allowedPaths.get(normalizeAssistantActionPath(path))
    if (targetPath) {
      result[targetPath] = value
    }
  }
  return result
}

function cleanFieldText(text: string) {
  const content = String(text || '').trim()
  if (!content) {
    return ''
  }

  const codeBlock = content.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)```$/)
  return (codeBlock ? codeBlock[1] : content).trim()
}

function sameFieldPath(left: string, right: string) {
  return normalizeAssistantActionPath(left) === normalizeAssistantActionPath(right)
}
