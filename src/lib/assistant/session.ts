import { request } from '@/lib/request'
import { streamValueText } from '@/lib/stream'
import type { AssistantMessage } from './client'

const SESSION_API = '/bot/admin/assistant/session'
const SESSIONS_API = '/bot/admin/assistant/sessions'
const NEW_SESSION_API = '/bot/admin/assistant/new_session'
const CLEAR_SESSION_API = '/bot/admin/assistant/clear_session'
const ARCHIVE_SESSION_API = '/bot/admin/assistant/archive_session'
const RESTORE_SESSION_API = '/bot/admin/assistant/restore_session'
const RENAME_SESSION_API = '/bot/admin/assistant/rename_session'
const MESSAGE_API = '/bot/admin/assistant/message'
const MEMORIES_API = '/bot/admin/assistant/memories'
const MEMORY_API = '/bot/admin/assistant/memory'
const UPDATE_MEMORY_API = '/bot/admin/assistant/update_memory'
const FORGET_MEMORY_API = '/bot/admin/assistant/forget_memory'
const MEMORY_CHOICE_API = '/bot/admin/assistant/memory_choice'

export type AssistantSessionStatus = 'active' | 'archived' | 'all'
export type AssistantMemoryStatus = 'active' | 'disabled' | 'all'
export type AssistantMemoryScope =
  | 'current'
  | 'global'
  | 'agent'
  | 'context'
  | 'session'
  | 'all'
export type AssistantMemoryKind =
  | 'working'
  | 'episodic'
  | 'semantic'
  | 'procedural'
  | 'persona'
  | 'content'
  | ''

export type AssistantSessionRecord = {
  id: number
  title: string
  title_source?: string
  context_key: string
  agent_key: string
  status: number
  message_count: number
  last_message_at: string
}

export type AssistantSessionPagination = {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export type AssistantMemoryRecord = {
  id: number
  kind: string
  title: string
  content: string
  tags?: unknown
  importance: number
  scope?: string
  agent_key?: string
  context_key?: string
  session_id?: number
  source?: string
  confidence?: number
  status: number
  created_at: string
}

export type AssistantMemoryReviewAction = {
  key: string
  label: string
  memory_id?: number
}

export type AssistantMemoryReview = {
  status: string
  type?: string
  text?: string
  candidate_id?: number
  source_message_id?: number
  title?: string
  content?: string
  scope?: string
  kind?: string
  reason?: string
  memory?: AssistantMemoryRecord | null
  existing?: AssistantMemoryRecord | null
  actions?: AssistantMemoryReviewAction[]
  error?: string
}

export type AssistantSessionPayload = {
  session: AssistantSessionRecord | null
  messages: AssistantMessage[]
  memories: AssistantMemoryRecord[]
}

export type AssistantSessionRequest = {
  sessionID?: number
  agentKey: string
  contextKey: string
  title?: string
  limit?: number
  newSession?: boolean
}

export type AssistantSessionListRequest = AssistantSessionRequest & {
  page?: number
  pageSize?: number
  keyword?: string
  status?: AssistantSessionStatus
}

export type AssistantSessionListPayload = {
  sessions: AssistantSessionRecord[]
  pagination: AssistantSessionPagination
}

export type AssistantMemoryListRequest = {
  agentKey: string
  contextKey: string
  page?: number
  pageSize?: number
  keyword?: string
  kind?: AssistantMemoryKind
  status?: AssistantMemoryStatus
  scope?: AssistantMemoryScope
}

export type AssistantMemoryListPayload = {
  memories: AssistantMemoryRecord[]
  pagination: AssistantSessionPagination
}

export async function loadAssistantSession(
  input: AssistantSessionRequest
): Promise<AssistantSessionPayload> {
  const result = await assistantRequest(
    input.newSession ? NEW_SESSION_API : SESSION_API,
    {
      session_id: input.sessionID,
      agent_key: input.agentKey,
      context_key: input.contextKey,
      title: input.title,
      limit: input.limit || 80,
      new_session: input.newSession,
    }
  )
  return normalizeSessionPayload(result)
}

export async function listAssistantSessions(
  input: AssistantSessionListRequest
): Promise<AssistantSessionListPayload> {
  const result = await assistantRequest(SESSIONS_API, {
    agent_key: input.agentKey,
    context_key: input.contextKey,
    limit: input.limit || input.pageSize || 10,
    page: input.page || 1,
    page_size: input.pageSize || input.limit || 10,
    keyword: input.keyword || '',
    status: input.status || 'active',
  })
  return {
    sessions: normalizeSessions(result.sessions),
    pagination: normalizePagination(result.pagination, input),
  }
}

export async function archiveAssistantSession(sessionID: number) {
  await assistantRequest(ARCHIVE_SESSION_API, { session_id: sessionID })
}

export async function restoreAssistantSession(sessionID: number) {
  await assistantRequest(RESTORE_SESSION_API, { session_id: sessionID })
}

export async function renameAssistantSession(input: {
  sessionID: number
  title: string
}) {
  const result = await assistantRequest(RENAME_SESSION_API, {
    session_id: input.sessionID,
    title: input.title,
  })
  return normalizeSession(result.session)
}

export async function clearAssistantSession(sessionID: number) {
  const result = await assistantRequest(CLEAR_SESSION_API, {
    session_id: sessionID,
  })
  return normalizeSessionPayload(result)
}

export async function saveAssistantMessage(input: {
  sessionID: number
  agentKey: string
  contextKey: string
  role: AssistantMessage['role']
  text: string
  kind?: string
  content?: Record<string, unknown>
  output?: Record<string, unknown>
  requestID?: string
  status?: number
  memoryEnabled?: boolean
}) {
  if (!input.sessionID) {
    return null
  }
  const result = await assistantRequest(MESSAGE_API, {
    session_id: input.sessionID,
    agent_key: input.agentKey,
    context_key: input.contextKey,
    role: input.role,
    kind: input.kind || 'chat',
    text: input.text,
    content: input.content || {},
    output: input.output || {},
    request_id: input.requestID || '',
    status: input.status || 1,
    memory_enabled: Boolean(input.memoryEnabled),
  })
  return result
}

export async function saveAssistantMemory(input: {
  agentKey: string
  contextKey: string
  title: string
  content: string
  kind?: string
  tags?: string[]
  importance?: number
  scope?: AssistantMemoryScope
  sessionID?: number
}) {
  const result = await assistantRequest(MEMORY_API, {
    agent_key: input.agentKey,
    context_key: input.contextKey,
    title: input.title,
    content: input.content,
    kind: input.kind || 'semantic',
    tags: input.tags || [],
    importance: input.importance || 60,
    scope: input.scope || '',
    session_id: input.sessionID || 0,
  })
  return normalizeMemory(result.memory)
}

export async function listAssistantMemories(
  input: AssistantMemoryListRequest
): Promise<AssistantMemoryListPayload> {
  const result = await assistantRequest(MEMORIES_API, {
    agent_key: input.agentKey,
    context_key: input.contextKey,
    page: input.page || 1,
    page_size: input.pageSize || 10,
    keyword: input.keyword || '',
    kind: input.kind || '',
    status: input.status || 'active',
    scope: input.scope || 'current',
  })
  return {
    memories: normalizeMemories(result.memories),
    pagination: normalizePagination(result.pagination, {
      agentKey: input.agentKey,
      contextKey: input.contextKey,
      page: input.page,
      pageSize: input.pageSize,
    }),
  }
}

export async function updateAssistantMemory(input: {
  id: number
  agentKey: string
  contextKey: string
  title?: string
  content?: string
  kind?: AssistantMemoryKind
  status?: number
  importance?: number
  tags?: string[]
  scope?: AssistantMemoryScope
  sessionID?: number
}) {
  const result = await assistantRequest(UPDATE_MEMORY_API, {
    id: input.id,
    agent_key: input.agentKey,
    context_key: input.contextKey,
    title: input.title,
    content: input.content,
    kind: input.kind,
    status: input.status,
    importance: input.importance,
    tags: input.tags,
    scope: input.scope || '',
    session_id: input.sessionID || 0,
  })
  return normalizeMemory(result.memory)
}

export async function deleteAssistantMemory(id: number) {
  await assistantRequest(FORGET_MEMORY_API, { id })
}

export async function chooseAssistantMemory(input: {
  candidateID?: number
  memoryID?: number
  sourceMessageID?: number
  choice: string
}) {
  return await assistantRequest(MEMORY_CHOICE_API, {
    candidate_id: input.candidateID || 0,
    memory_id: input.memoryID || 0,
    source_message_id: input.sourceMessageID || 0,
    choice: input.choice,
  })
}

export function assistantSessionContextKey(
  prefix: string,
  values: Record<string, unknown>
) {
  const parts = Object.entries(values)
    .filter(([, value]) => value != null && streamValueText(value) !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${streamValueText(value)}`)
  return [prefix, ...parts].join('|')
}

async function assistantRequest(api: string, payload: Record<string, unknown>) {
  const result = await request(api, 'post', payload)
  if (result.code !== 0) {
    throw new Error(result.message || 'AI 助理请求失败')
  }
  return isPlainObject(result.data) ? result.data : {}
}

function normalizeSessionPayload(value: unknown): AssistantSessionPayload {
  const data = isPlainObject(value) ? value : {}
  return {
    session: normalizeSession(data.session),
    messages: normalizeMessages(data.messages),
    memories: normalizeMemories(data.memories),
  }
}

function normalizeMessages(value: unknown): AssistantMessage[] {
  const rows = Array.isArray(value) ? value : []
  return rows.map(normalizeMessage).filter(Boolean) as AssistantMessage[]
}

function normalizeMessage(value: unknown): AssistantMessage | null {
  if (!isPlainObject(value)) {
    return null
  }
  const role = streamValueText(value.role) === 'user' ? 'user' : 'assistant'
  return {
    role,
    content: streamValueText(value.text),
    type: streamValueText(value.kind),
    data: isPlainObject(value.content) && isPlainObject(value.content.data)
      ? value.content.data
      : undefined,
    output: isPlainObject(value.output) ? value.output : undefined,
    interaction: isPlainObject(value.content) &&
      isPlainObject(value.content.interaction)
      ? value.content.interaction
      : undefined,
    interaction_answered: isPlainObject(value.content)
      ? Boolean(value.content.interaction_answered)
      : false,
    interaction_data: isPlainObject(value.content) &&
      isPlainObject(value.content.interaction_data)
      ? value.content.interaction_data
      : undefined,
  }
}

function normalizeSessions(value: unknown) {
  const rows = Array.isArray(value) ? value : []
  return rows.map(normalizeSession).filter(Boolean) as AssistantSessionRecord[]
}

function normalizeSession(value: unknown): AssistantSessionRecord | null {
  if (!isPlainObject(value)) {
    return null
  }
  const id = Number(value.id || 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }
  return {
    id,
    title: streamValueText(value.title),
    title_source: streamValueText(value.title_source),
    context_key: streamValueText(value.context_key),
    agent_key: streamValueText(value.agent_key),
    status: Number(value.status || 0),
    message_count: Number(value.message_count || 0),
    last_message_at: streamValueText(value.last_message_at),
  }
}

function normalizePagination(
  value: unknown,
  fallback: AssistantSessionListRequest
): AssistantSessionPagination {
  const data = isPlainObject(value) ? value : {}
  const page = positiveNumber(data.page, fallback.page || 1)
  const pageSize = positiveNumber(
    data.page_size ?? data.pageSize,
    fallback.pageSize || fallback.limit || 10
  )
  return {
    page,
    page_size: pageSize,
    total: positiveNumber(data.total, 0),
    total_pages: positiveNumber(data.total_pages ?? data.totalPages, 0),
  }
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    return fallback
  }
  return number
}

function normalizeMemories(value: unknown) {
  const rows = Array.isArray(value) ? value : []
  return rows.map(normalizeMemory).filter(Boolean) as AssistantMemoryRecord[]
}

function normalizeMemory(value: unknown): AssistantMemoryRecord | null {
  if (!isPlainObject(value)) {
    return null
  }
  const id = Number(value.id || 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }
  return {
    id,
    kind: streamValueText(value.kind),
    title: streamValueText(value.title),
    content: streamValueText(value.content),
    tags: value.tags,
    importance: Number(value.importance || 0),
    scope: streamValueText(value.scope),
    agent_key: streamValueText(value.agent_key),
    context_key: streamValueText(value.context_key),
    session_id: Number(value.session_id || 0),
    source: streamValueText(value.source),
    confidence: Number(value.confidence || 0),
    status: Number(value.status || 0),
    created_at: streamValueText(value.created_at),
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
