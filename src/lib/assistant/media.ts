import { runAgentStream } from '@/lib/agent/runner'
import type {
  AgentInteraction,
  AgentInteractionSubmitResult,
} from '@/lib/agent/types'
import {
  normalizeUploadItem,
  normalizeUploadUrlItems,
  resolveResourceKind,
  type ResourceUploadRule,
} from '@/lib/resource'
import { importRemoteFileByRuleStream, type UploadFileItem } from '@/lib/upload'
import type { Item } from '@/lib/schema'
import type { PageStore } from '@/lib/store'
import {
  buildAssistantFieldContext,
  buildAssistantPageContext,
  type AssistantFieldContext,
} from './context'
import { runAssistantAgent, type AssistantStatusHandler } from './client'
import type { AssistantPageRegistration, AssistantPageScope } from './registry'
import {
  buildAssistantReferenceSummary,
  type AssistantReferenceFile,
} from './reference'
import { loadAssistantPermissionContextSafe } from './permission'
import { withAssistantTaskReferences } from './task'
import {
  buildAssistantInteractionInput,
  normalizeAssistantInteraction,
} from './interaction'

export type AssistantMediaKind = 'image' | 'video' | 'audio' | 'file'
export type AssistantMediaSurface = 'upload' | 'editor'

export type AssistantMediaGenerationOptions = {
  store: PageStore
  scope?: AssistantPageScope
  route?: string
  field?: AssistantFieldContext
  kind: AssistantMediaKind
  surface: AssistantMediaSurface
  instruction?: string
  references?: AssistantReferenceFile[]
  uploadRules?: ResourceUploadRule[]
  maxResults?: number
  signal?: AbortSignal
  onStatus?: AssistantStatusHandler
}

export type AssistantMediaInteraction = AgentInteraction
export type AssistantMediaInteractionSubmitResult = AgentInteractionSubmitResult

export type AssistantMediaSaveStatusHandler = (
  text: string,
  progress?: number | null
) => void

export type AssistantMediaInteractionResumeOptions =
  AssistantMediaGenerationOptions & {
    interaction: AssistantMediaInteraction
    interactionText?: string
    interactionResult: AssistantMediaInteractionSubmitResult
  }

export type SaveAssistantGeneratedMediaOptions = {
  kind: AssistantMediaKind
  uploadRule?: ResourceUploadRule
  maxItems?: number
  onStatus?: AssistantMediaSaveStatusHandler
}

export class AssistantMediaInteractionRequiredError extends Error {
  interaction: AssistantMediaInteraction
  interactionText: string

  constructor(interaction: AssistantMediaInteraction, interactionText: string) {
    super('生成媒体前需要补充能力参数。')
    this.name = 'AssistantMediaInteractionRequiredError'
    this.interaction = interaction
    this.interactionText = interactionText
  }
}

const MEDIA_FIELD_ALIASES: Record<AssistantMediaKind, string[]> = {
  image: [
    'images',
    'image',
    'url',
    'image_url',
    'first_frame_url',
    'last_frame_url',
    'cover_url',
    'thumbnail_url',
  ],
  video: ['videos', 'video', 'url', 'video_url'],
  audio: ['audios', 'audio', 'url', 'audio_url'],
  file: ['files', 'file', 'url', 'file_url'],
}

const NESTED_MEDIA_KEYS = [
  'output',
  'data',
  'content',
  'result',
  'results',
  'media',
  'payload',
]
const URL_PATTERN = /(https?:\/\/[^\s<>"')]+|\/front\/upload\/[^\s<>"')]+)/g

export async function runAssistantMediaGeneration({
  store,
  scope = 'modal',
  route,
  field,
  kind,
  surface,
  instruction,
  references,
  uploadRules,
  maxResults = 12,
  signal,
  onStatus,
}: AssistantMediaGenerationOptions) {
  return requestAssistantMediaGeneration({
    store,
    scope,
    route,
    field,
    kind,
    surface,
    instruction,
    references,
    uploadRules,
    maxResults,
    signal,
    onStatus,
  })
}

export async function continueAssistantMediaGeneration({
  interaction,
  interactionText,
  interactionResult,
  ...options
}: AssistantMediaInteractionResumeOptions) {
  return requestAssistantMediaPowerGeneration(
    options,
    interaction,
    interactionResult,
    interactionText
  )
}

async function requestAssistantMediaGeneration({
  store,
  scope = 'modal',
  route,
  field,
  kind,
  surface,
  instruction,
  references,
  uploadRules,
  maxResults = 12,
  signal,
  onStatus,
}: AssistantMediaGenerationOptions,
) {
  const registration = buildMediaRegistration(store, scope, route)
  const context = buildAssistantPageContext(registration)
  let finalOutput: Record<string, unknown> = {}
  const text = buildMediaUserText(surface, kind, field, instruction, references)

  onStatus?.(`正在请求 AI 生成${assistantMediaKindLabel(kind)}`)
  const permissionContext = await loadAssistantPermissionContextSafe()
  if (signal?.aborted) {
    return []
  }
  const finalText = await runAssistantAgent({
    text,
    task: buildMediaTask(surface, kind, field, instruction, references, uploadRules),
    context,
    permissionContext,
    history: [],
    signal,
    onStatus,
    onFinalOutput: (output) => {
      finalOutput = output
    },
  })
  if (signal?.aborted) {
    return []
  }

  const interaction = normalizeAssistantInteraction(finalOutput)
  if (interaction) {
    throw new AssistantMediaInteractionRequiredError(interaction, finalText)
  }

  const items = extractAssistantMediaItems(finalOutput, finalText, kind, maxResults)
  if (items.length === 0) {
    throw new Error(
      cleanMediaGenerationFallbackText(finalText) ||
        `AI 没有返回可用的${assistantMediaKindLabel(kind)}地址。`
    )
  }
  return items
}

export async function saveAssistantGeneratedMediaItems(
  items: UploadFileItem[],
  {
    kind,
    uploadRule,
    maxItems = items.length,
    onStatus,
  }: SaveAssistantGeneratedMediaOptions
) {
  const selectedItems = items.slice(0, Math.max(1, maxItems))
  if (!uploadRule) {
    return selectedItems
  }

  const result: UploadFileItem[] = []
  for (const current of selectedItems) {
    const sourceURL = resourceURL(current)
    if (!sourceURL) {
      continue
    }
    if (Number(current.rule_id || 0) > 0) {
      result.push(current)
      continue
    }

    try {
      onStatus?.(`正在保存${assistantMediaKindLabel(kind)}到资源库`)
      const uploaded = await importRemoteFileByRuleStream(uploadRule.ruleId, sourceURL, {
        kind: uploadRule.kind || kind,
        name: current.name,
        bizKey: uploadRule.bizKey || 'energon',
        bizName: uploadRule.bizName || 'AI生成',
        categoryId: uploadRule.categoryId,
        onStatus: (status) => {
          onStatus?.(
            status.message || `正在保存${assistantMediaKindLabel(kind)}到资源库`,
            status.progress
          )
        },
      })
      result.push(normalizeUploadItem(uploaded))
    } catch {
      result.push(current)
      onStatus?.(`资源库保存失败，已使用生成${assistantMediaKindLabel(kind)}地址。`)
    }
  }

  return result
}

export function resolveAssistantMediaUploadRule(
  rules: ResourceUploadRule[] | undefined,
  kind: AssistantMediaKind
) {
  const items = Array.isArray(rules) ? rules : []
  const normalizedKind = resolveResourceKind({ kind })
  return (
    items.find(
      (item) =>
        resolveResourceKind({ kind: item.kind, accept: item.accept }) === normalizedKind
    ) ||
    items.find(
      (item) => resolveResourceKind({ kind: item.kind, accept: item.accept }) === 'file'
    ) ||
    items[0]
  )
}

export function assistantMediaKindLabel(kind: AssistantMediaKind) {
  switch (kind) {
    case 'image':
      return '图片'
    case 'video':
      return '视频'
    case 'audio':
      return '音频'
    default:
      return '文件'
  }
}

export function extractAssistantMediaItems(
  output: Record<string, unknown>,
  text: string,
  kind: AssistantMediaKind,
  maxResults = 12
) {
  const collected: UploadFileItem[] = []
  appendMediaItems(collected, output, kind)
  appendMediaItems(collected, text, kind)
  return uniqueMediaItems(collected).slice(0, Math.max(1, maxResults))
}

export function resolveAssistantFieldContextFromItem(item: Item) {
  return buildAssistantFieldContext(item)
}

function buildMediaRegistration(
  store: PageStore,
  scope: AssistantPageScope,
  route?: string
): AssistantPageRegistration {
  const state = store.getState()
  return {
    id: 'assistant-media-generate',
    store,
    scope,
    route: route || state.pagePath || state.schema.page.route || '',
  }
}

function buildMediaUserText(
  surface: AssistantMediaSurface,
  kind: AssistantMediaKind,
  field?: AssistantFieldContext,
  instruction?: string,
  references?: AssistantReferenceFile[]
) {
  const fieldText = field ? `字段：${field.name}（${field.path}）` : '当前控件'
  const surfaceText = surface === 'editor' ? '编辑器正文' : '上传字段'
  const parts = [
    `请为${surfaceText}生成一份${assistantMediaKindLabel(kind)}资源，并返回可直接插入页面的媒体结果。`,
    fieldText,
  ]

  const userInstruction = String(instruction || '').trim()
  if (userInstruction) {
    parts.push(`补充要求：\n${userInstruction}`)
  }

  const referenceSummary = buildAssistantReferenceSummary(references)
  if (referenceSummary) {
    parts.push(referenceSummary)
  }

  return parts.join('\n\n')
}

function buildMediaTask(
  surface: AssistantMediaSurface,
  kind: AssistantMediaKind,
  field?: AssistantFieldContext,
  instruction?: string,
  references?: AssistantReferenceFile[],
  uploadRules?: ResourceUploadRule[]
) {
  return withAssistantTaskReferences({
    type: surface === 'editor' ? 'generate_editor_media' : 'generate_upload_media',
    media_kind: kind,
    target_field: field,
    instruction: String(instruction || '').trim() || undefined,
    upload_rules: normalizeTaskUploadRules(uploadRules),
    save: false,
  }, references)
}

function normalizeTaskUploadRules(rules?: ResourceUploadRule[]) {
  const items = Array.isArray(rules) ? rules : []
  if (items.length === 0) {
    return undefined
  }
  return items.map((item) => ({
    kind: item.kind,
    accept: item.accept,
    biz_key: item.bizKey,
    biz_name: item.bizName,
  }))
}

async function requestAssistantMediaPowerGeneration(
  {
    field,
    surface,
    instruction,
    references,
    kind,
    maxResults = 12,
    signal,
    onStatus,
  }: AssistantMediaGenerationOptions,
  interaction: AssistantMediaInteraction,
  interactionResult: AssistantMediaInteractionSubmitResult,
  interactionText = ''
) {
  const power = firstText(interaction.power)
  if (!power) {
    throw new Error('AI 没有返回可调用的媒体能力。')
  }

  onStatus?.(`正在调用${assistantMediaKindLabel(kind)}能力`)
  const text = buildMediaUserText(surface, kind, field, instruction, references)
  const { finalOutput, textOutput } = await runAgentStream<Record<string, unknown>>({
    agent: 'front-assistant',
    input: buildAssistantInteractionInput(interaction, interactionResult),
    history: [
      {
        role: 'user',
        text,
      },
      {
        role: 'assistant',
        text: interactionText,
        interaction,
        interaction_answered: false,
      },
    ],
    signal,
    onStatus,
  })
  if (signal?.aborted) {
    return []
  }
  const nextInteraction = normalizeAssistantInteraction(finalOutput)
  if (nextInteraction) {
    throw new AssistantMediaInteractionRequiredError(nextInteraction, textOutput)
  }
  const items = extractAssistantMediaItems(finalOutput, textOutput, kind, maxResults)
  if (items.length === 0) {
    throw new Error(`媒体能力没有返回可用的${assistantMediaKindLabel(kind)}地址。`)
  }
  return items
}

function appendMediaItems(
  result: UploadFileItem[],
  value: unknown,
  kind: AssistantMediaKind
) {
  if (value == null || value === '') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendMediaItems(result, item, kind))
    return
  }

  if (typeof value === 'string') {
    appendMediaString(result, value, kind)
    return
  }

  if (!isPlainObject(value)) {
    return
  }

  const directItem = mediaItemFromObject(value, kind)
  if (directItem) {
    result.push(directItem)
  }

  for (const key of MEDIA_FIELD_ALIASES[kind]) {
    appendMediaItems(result, value[key], kind)
  }
  for (const key of NESTED_MEDIA_KEYS) {
    appendMediaItems(result, value[key], kind)
  }
}

function appendMediaString(
  result: UploadFileItem[],
  value: string,
  kind: AssistantMediaKind
) {
  const text = value.trim()
  if (!text) {
    return
  }

  if (looksLikeJSON(text)) {
    try {
      appendMediaItems(result, JSON.parse(text), kind)
      return
    } catch {
      // Keep parsing as plain text below.
    }
  }

  const urls = extractMediaURLs(text)
  if (urls.length > 0) {
    result.push(...normalizeUploadUrlItems(urls, { kind }))
  }
}

function mediaItemFromObject(value: Record<string, unknown>, kind: AssistantMediaKind) {
  const url = firstText(
    value.url,
    value.open_url,
    value.download,
    value.thumbnail,
    value.image_url,
    value.video_url,
    value.audio_url,
    value.file_url
  )
  if (!url) {
    return null
  }
  return normalizeUploadItem({
    ...value,
    kind: firstText(value.kind) || kind,
    url,
    open_url: firstText(value.open_url) || url,
  })
}

function uniqueMediaItems(items: UploadFileItem[]) {
  const result: UploadFileItem[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const key = resourceURL(item) || String(item.id || '')
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(item)
  }
  return result
}

function extractMediaURLs(text: string) {
  const result = new Set<string>()
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = cleanExtractedURL(match[0])
    if (url) {
      result.add(url)
    }
  }
  return Array.from(result)
}

function cleanExtractedURL(value: string) {
  return String(value || '')
    .trim()
    .replace(/[.,;，。；]+$/, '')
}

function cleanMediaGenerationFallbackText(text: string) {
  return String(text || '')
    .replace(/```(?:agent-interaction|agent-result|agent-output|json)\s*[\s\S]*?```/g, '')
    .trim()
}

function resourceURL(item: UploadFileItem) {
  return String(item.url || item.open_url || item.download || item.thumbnail || '').trim()
}

function looksLikeJSON(value: string) {
  return value.startsWith('{') || value.startsWith('[')
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) {
      return text
    }
  }
  return ''
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
