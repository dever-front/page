import { toast } from 'sonner'
import type {
  AgentInteraction,
  AgentInteractionSubmitResult,
} from '@/lib/agent/types'
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
import {
  runAssistantAgent,
  type AssistantMessage,
  type AssistantStatusHandler,
} from './client'
import {
  assistantSessionContextKey,
  loadAssistantSession,
  saveAssistantMessage,
} from './session'
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
import {
  buildAssistantInteractionInput,
  normalizeAssistantInteraction,
} from './interaction'

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

export type AssistantQuickFillInteraction = AgentInteraction
export type AssistantQuickFillInteractionSubmitResult =
  AgentInteractionSubmitResult

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

export type AssistantQuickFillResumeOptions = AssistantQuickFillOptions & {
  interaction: AssistantQuickFillInteraction
  interactionText?: string
  interactionResult: AssistantQuickFillInteractionSubmitResult
}

export type AssistantContextQuickFillResumeOptions =
  AssistantContextQuickFillOptions & {
    interaction: AssistantQuickFillInteraction
    interactionText?: string
    interactionResult: AssistantQuickFillInteractionSubmitResult
  }

export class AssistantQuickFillInteractionRequiredError extends Error {
  interaction: AssistantQuickFillInteraction
  interactionText: string

  constructor(interaction: AssistantQuickFillInteraction, interactionText: string) {
    super('继续填写前需要补充信息。')
    this.name = 'AssistantQuickFillInteractionRequiredError'
    this.interaction = interaction
    this.interactionText = interactionText
  }
}

type QuickFillAgentRequest = {
  text: string
  input?: Record<string, unknown>
  history?: AssistantMessage[]
  mode: AssistantQuickFillMode
  field?: AssistantFieldContext
  sourceText?: string
  instruction?: string
  references?: AssistantReferenceFile[]
  overwrite: boolean
  context: AssistantPageContext
  permissionContext: Awaited<ReturnType<typeof loadAssistantPermissionContextSafe>>
  signal?: AbortSignal
  onStatus?: AssistantStatusHandler
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
  const text = buildQuickFillUserText(mode, field, sourceText, instruction, references)
  const { finalText, finalOutput } = await requestQuickFillAgent({
    text,
    mode,
    field,
    sourceText,
    instruction,
    references,
    overwrite,
    context,
    permissionContext,
    signal,
    onStatus,
  })
  if (signal?.aborted) {
    return { applied: false, text: finalText }
  }
  ensureNoQuickFillInteraction(finalOutput, finalText)
  return applyAssistantQuickFillResult({
    finalText,
    registration,
    context,
    permissionContext,
    field,
    store,
  })
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
  const text = buildQuickFillUserText(mode, field, sourceText, instruction, references)
  const { finalText, finalOutput } = await requestQuickFillAgent({
    text,
    mode,
    field,
    sourceText,
    instruction,
    references,
    overwrite,
    context,
    permissionContext,
    signal,
    onStatus,
  })
  if (signal?.aborted) {
    return { applied: false, text: finalText }
  }
  ensureNoQuickFillInteraction(finalOutput, finalText)
  return applyAssistantContextQuickFillResult({
    finalText,
    context,
    field,
    onApplyField,
    onApplyValues,
  })
}

export async function continueAssistantQuickFill({
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
  interaction,
  interactionText,
  interactionResult,
}: AssistantQuickFillResumeOptions): Promise<AssistantQuickFillResult> {
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

  onStatus?.('正在继续 AI 填写')
  const permissionContext = await loadAssistantPermissionContextSafe()
  if (signal?.aborted) {
    return { applied: false, text: '' }
  }

  const originalText = buildQuickFillUserText(
    mode,
    field,
    sourceText,
    instruction,
    references
  )
  const { finalText, finalOutput } = await requestQuickFillAgent({
    text: interactionResult.text,
    input: buildAssistantInteractionInput(interaction, interactionResult),
    mode,
    field,
    sourceText,
    instruction,
    references,
    overwrite,
    context,
    permissionContext,
    history: buildQuickFillInteractionHistory(
      originalText,
      interaction,
      interactionText
    ),
    signal,
    onStatus,
  })
  if (signal?.aborted) {
    return { applied: false, text: finalText }
  }
  ensureNoQuickFillInteraction(finalOutput, finalText)
  return applyAssistantQuickFillResult({
    finalText,
    registration,
    context,
    permissionContext,
    field,
    store,
  })
}

export async function continueAssistantContextQuickFill({
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
  interaction,
  interactionText,
  interactionResult,
}: AssistantContextQuickFillResumeOptions): Promise<AssistantQuickFillResult> {
  const mode = resolveQuickFillMode(field, sourceText)

  if (!context?.form?.fields.length) {
    toast.error('当前页面没有可由 AI 填写的表单字段。')
    return { applied: false, text: '' }
  }
  if (field && !context.form.fields.some((item) => sameFieldPath(item.path, field.path))) {
    toast.error('当前字段不在可填写表单范围内。')
    return { applied: false, text: '' }
  }

  onStatus?.('正在继续 AI 填写')
  const permissionContext = await loadAssistantPermissionContextSafe()
  if (signal?.aborted) {
    return { applied: false, text: '' }
  }

  const originalText = buildQuickFillUserText(
    mode,
    field,
    sourceText,
    instruction,
    references
  )
  const { finalText, finalOutput } = await requestQuickFillAgent({
    text: interactionResult.text,
    input: buildAssistantInteractionInput(interaction, interactionResult),
    mode,
    field,
    sourceText,
    instruction,
    references,
    overwrite,
    context,
    permissionContext,
    history: buildQuickFillInteractionHistory(
      originalText,
      interaction,
      interactionText
    ),
    signal,
    onStatus,
  })
  if (signal?.aborted) {
    return { applied: false, text: finalText }
  }
  ensureNoQuickFillInteraction(finalOutput, finalText)
  return applyAssistantContextQuickFillResult({
    finalText,
    context,
    field,
    onApplyField,
    onApplyValues,
  })
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

function ensureNoQuickFillInteraction(
  finalOutput: Record<string, unknown>,
  finalText: string
) {
  const interaction = normalizeAssistantInteraction(finalOutput)
  if (interaction) {
    throw new AssistantQuickFillInteractionRequiredError(interaction, finalText)
  }
}

async function requestQuickFillAgent({
  text,
  input,
  history = [],
  mode,
  field,
  sourceText,
  instruction,
  references,
  overwrite,
  context,
  permissionContext,
  signal,
  onStatus,
}: QuickFillAgentRequest) {
  const agentKey = 'front-assistant'
  const contextKey = quickFillSessionContextKey(context, mode, field)
  const session = await loadAssistantSession({
    agentKey,
    contextKey,
    title: quickFillSessionTitle(mode, field),
    limit: 40,
  })
  const sessionID = session.session?.id || 0
  const task = buildAssistantFormFillTask({
    mode,
    field,
    sourceText,
    instruction,
    references,
    overwrite,
  })
  await recordQuickFillMessage({
    sessionID,
    agentKey,
    contextKey,
    role: 'user',
    text,
    kind: history.length > 0 ? 'quick_fill_resume' : 'quick_fill',
    content: {
      mode,
      field: field ? { path: field.path, name: field.name, type: field.type } : undefined,
      input: input || {},
      task,
    },
  })

  let finalOutput: Record<string, unknown> = {}
  let finalText = ''
  try {
    finalText = await runAssistantAgent({
      text,
      input,
      task,
      assistantSessionID: sessionID,
      context,
      permissionContext,
      history: mergeQuickFillHistory(session.messages, history),
      signal,
      onStatus,
      onFinalOutput: (output) => {
        finalOutput = output
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 填写失败'
    await recordQuickFillMessage({
      sessionID,
      agentKey,
      contextKey,
      role: 'assistant',
      text: message,
      kind: 'quick_fill_error',
      output: { error: message },
      status: 2,
    })
    throw error
  }
  const interaction = normalizeAssistantInteraction(finalOutput)
  await recordQuickFillMessage({
    sessionID,
    agentKey,
    contextKey,
    role: 'assistant',
    text: finalText,
    kind: 'quick_fill',
    content: {
      task,
      interaction,
      interaction_answered: false,
    },
    output: finalOutput,
  })
  return { finalText, finalOutput }
}

function quickFillSessionContextKey(
  context: AssistantPageContext,
  mode: AssistantQuickFillMode,
  field?: AssistantFieldContext
) {
  return assistantSessionContextKey('quick-fill', {
    route: context.route,
    scope: context.scope,
    mode,
    field: field?.path || '',
  })
}

function quickFillSessionTitle(
  mode: AssistantQuickFillMode,
  field?: AssistantFieldContext
) {
  if (mode === 'field' && field) {
    return `AI 填写：${field.name}`
  }
  if (mode === 'paste') {
    return 'AI 填写：粘贴解析'
  }
  return 'AI 填写：当前表单'
}

function mergeQuickFillHistory(
  sessionMessages: AssistantMessage[],
  runHistory: AssistantMessage[]
) {
  return [...sessionMessages.slice(-20), ...runHistory]
}

async function recordQuickFillMessage(
  input: Parameters<typeof saveAssistantMessage>[0]
) {
  try {
    await saveAssistantMessage(input)
  } catch {
    // 保存会话失败不能阻断本次 AI 填写。
  }
}

function buildQuickFillInteractionHistory(
  text: string,
  interaction: AssistantQuickFillInteraction,
  interactionText = ''
): AssistantMessage[] {
  return [
    {
      role: 'user' as const,
      content: text,
    },
    {
      role: 'assistant' as const,
      content: interactionText,
      interaction,
      interaction_answered: false,
    },
  ]
}

async function applyAssistantQuickFillResult({
  finalText,
  registration,
  context,
  permissionContext,
  field,
  store,
}: {
  finalText: string
  registration: AssistantPageRegistration
  context: AssistantPageContext
  permissionContext: Awaited<ReturnType<typeof loadAssistantPermissionContextSafe>>
  field?: AssistantFieldContext
  store: PageStore
}): Promise<AssistantQuickFillResult> {
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

async function applyAssistantContextQuickFillResult({
  finalText,
  context,
  field,
  onApplyField,
  onApplyValues,
}: {
  finalText: string
  context: AssistantPageContext
  field?: AssistantFieldContext
  onApplyField?: (path: string, value: unknown) => void | Promise<void>
  onApplyValues?: (values: Record<string, unknown>) => void | Promise<void>
}): Promise<AssistantQuickFillResult> {
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
      const values = filterPatchValues(action.values, context.form?.fields || [])
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
  if (!content || isResultShellText(content) || hasActionLikeCodeBlock(content)) {
    return ''
  }

  const codeBlock = content.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)```$/)
  const value = (codeBlock ? codeBlock[1] : content).trim()
  return isResultShellText(value) ? '' : value
}

function isResultShellText(text: string) {
  const value = text.trim()
  return value === '内容已生成，点击查看结果。' || value === '内容已生成'
}

function hasActionLikeCodeBlock(text: string) {
  return /```(?:front-action|json)\s*[\s\S]*"type"\s*:\s*"(?:fill_form|patch_form|open_page|open_form)"[\s\S]*```/i.test(
    text
  )
}

function sameFieldPath(left: string, right: string) {
  return normalizeAssistantActionPath(left) === normalizeAssistantActionPath(right)
}
