const resultFenceLangs = ['agent-result', 'agent-output', 'json'] as const

const resultOutputKeys = [
  'title',
  'text',
  'reasoning',
  'rich',
  'images',
  'videos',
  'audios',
  'files',
  'json',
  'error',
  'progress',
  'meta',
] as const

const nestedOutputKeys = ['output', 'result', 'data', 'json', 'value'] as const

export type AgentResultPayloadExtract = {
  cleanText: string
  payload: Record<string, unknown>
}

export function normalizeAgentResultOutputValue(value: unknown): unknown {
  return normalizeAgentResultValue(value, new Set())
}

export function extractAgentResultPayload(text: string): AgentResultPayloadExtract | undefined {
  for (const lang of resultFenceLangs) {
    const result = extractAgentResultPayloadByLang(text, lang)
    if (result) {
      return result
    }
  }
  const payload = parseAgentResultPayload(text)
  return payload ? { cleanText: '', payload } : undefined
}

export function isAgentResultProtocolText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return (
    text.includes('```agent-result') ||
    text.includes('```agent-output') ||
    text.includes('```json')
  )
}

export function agentResultPayloadTitle(value: unknown) {
  if (!isPlainRecord(value)) {
    return ''
  }
  const content = isPlainRecord(value.content) ? value.content : {}
  return firstText(value.title, content.title)
}

function normalizeAgentResultValue(value: unknown, seen: Set<unknown>): unknown {
  if (typeof value === 'string') {
    const protocol = extractAgentResultPayload(value)
    if (protocol) {
      return normalizeAgentResultPayload(protocol.payload, protocol.cleanText, seen)
    }
    const payload = parseAgentResultPayload(value)
    if (payload) {
      return normalizeAgentResultPayload(payload, '', seen)
    }
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAgentResultValue(item, seen))
      .filter(hasResultDisplayValue)
  }

  if (!isPlainRecord(value)) {
    return value
  }
  if (seen.has(value)) {
    return value
  }
  seen.add(value)

  // Tiptap documents also carry a `content` field. Preserve them before the
  // agent-result protocol check so they are rendered as rich content instead
  // of being reduced to an empty result object.
  if (isRichTextDocument(value)) {
    return value
  }

  const textProtocol = extractAgentResultPayload(firstText(value.text))
  if (textProtocol) {
    return normalizeAgentResultPayload(textProtocol.payload, textProtocol.cleanText, seen)
  }

  if (isAgentResultPayload(value)) {
    return normalizeAgentResultPayload(value, '', seen)
  }

  return value
}

function normalizeAgentResultPayload(
  payload: Record<string, unknown>,
  fallbackText: string,
  seen: Set<unknown>
): Record<string, unknown> {
  const nested = firstNestedResultOutput(payload, seen)
  if (nested && hasResultDisplayValue(nested)) {
    return nested
  }

  const result: Record<string, unknown> = {}
  const content = normalizeAgentContentRecord(payload.content)

  if (content) {
    copyResultOutputFields(result, content)
  }
  copyResultOutputFields(result, payload)

  const text = agentResultText(payload) || fallbackText
  if (text) {
    result.text = text
  }

  if (!hasResultDisplayValue(result) && content) {
    return content
  }
  return result
}

function firstNestedResultOutput(
  payload: Record<string, unknown>,
  seen: Set<unknown>
): Record<string, unknown> | null {
  for (const key of nestedOutputKeys) {
    const value = payload[key]
    if (value == null || value === payload) {
      continue
    }
    if (key === 'json' && !isAgentResultPayload(value) && !isAgentResultProtocolText(value)) {
      continue
    }
    const normalized = normalizeAgentResultValue(value, seen)
    if (typeof normalized === 'string' && normalized.trim()) {
      return {
        text: normalized.trim(),
      }
    }
    if (isPlainRecord(normalized) && hasResultDisplayValue(normalized)) {
      return normalized
    }
  }
  return null
}

function copyResultOutputFields(target: Record<string, unknown>, source: Record<string, unknown>) {
  resultOutputKeys.forEach((key) => {
    const value = source[key]
    if (!hasResultDisplayValue(value)) {
      return
    }
    if (key === 'json' && (isAgentResultPayload(value) || isAgentResultProtocolText(value))) {
      return
    }
    target[key] = value
  })
  if (!hasResultDisplayValue(target.rich) && isPlainRecord(source.value)) {
    target.rich = source.value
  }
}

function normalizeAgentContentRecord(value: unknown): Record<string, unknown> | null {
  if (isPlainRecord(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    return {
      format: 'markdown',
      text: value.trim(),
    }
  }
  return null
}

function extractAgentResultPayloadByLang(
  text: string,
  lang: string
): AgentResultPayloadExtract | undefined {
  const open = `\`\`\`${lang}`
  const start = text.indexOf(open)
  if (start < 0) {
    return undefined
  }

  let bodyStart = start + open.length
  while (bodyStart < text.length && isFenceWhitespace(text[bodyStart])) {
    bodyStart += 1
  }

  let searchStart = bodyStart
  while (searchStart < text.length) {
    const end = text.indexOf('```', searchStart)
    if (end < 0) {
      const payload = parseAgentResultPayload(text.slice(bodyStart))
      return payload
        ? {
            cleanText: text.slice(0, start).trim(),
            payload,
          }
        : undefined
    }

    const payload = parseAgentResultPayload(text.slice(bodyStart, end))
    if (payload) {
      return {
        cleanText: `${text.slice(0, start)}${text.slice(end + 3)}`.trim(),
        payload,
      }
    }
    searchStart = end + 3
  }

  return undefined
}

function parseAgentResultPayload(value: string) {
  const text = value.trim()
  if (!text) {
    return undefined
  }
  const repaired = repairJSONControlChars(text)
  const sources = repaired === text ? [text] : [text, repaired]
  for (const source of sources) {
    try {
      const parsed = JSON.parse(source)
      if (isAgentResultPayload(parsed)) {
        return parsed
      }
    } catch {
      // Try the repaired source when raw streamed JSON contains control chars.
    }
  }
  return undefined
}

function isAgentResultPayload(value: unknown): value is Record<string, unknown> {
  if (!isPlainRecord(value)) {
    return false
  }
  const kind = firstText(value.kind, value.type, value.event).toLowerCase()
  const content = isPlainRecord(value.content) ? value.content : null
  return (
    ['final', 'result', 'final_result', 'answer', 'tool', 'tool_result', 'power_result'].includes(kind) ||
    'content' in value ||
    'tasks' in value ||
    'suggestions' in value ||
    resultOutputKeys.some((key) => hasResultDisplayValue(value[key])) ||
    (content != null && resultOutputKeys.some((key) => hasResultDisplayValue(content[key])))
  )
}

function isRichTextDocument(value: unknown): value is Record<string, unknown> {
  return (
    isPlainRecord(value) &&
    value.type === 'doc' &&
    (value.content == null || Array.isArray(value.content))
  )
}

function agentResultText(value: unknown): string {
  if (!isPlainRecord(value)) {
    return typeof value === 'string' ? value.trim() : ''
  }
  const direct = firstText(value.text)
  if (direct) {
    return direct
  }
  const content = value.content
  if (typeof content === 'string') {
    return content.trim()
  }
  return isPlainRecord(content) ? firstText(content.text) : ''
}

function hasResultDisplayValue(value: unknown): boolean {
  if (value == null || value === '') {
    return false
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return true
  }
  if (Array.isArray(value)) {
    return value.some(hasResultDisplayValue)
  }
  if (isPlainRecord(value)) {
    return Object.keys(value).length > 0
  }
  return false
}

function repairJSONControlChars(value: string) {
  let result = ''
  let inString = false
  let escaped = false
  for (const char of value) {
    if (escaped) {
      result += char
      escaped = false
      continue
    }
    if (char === '\\') {
      result += char
      escaped = inString
      continue
    }
    if (char === '"') {
      inString = !inString
      result += char
      continue
    }
    if (inString && char.charCodeAt(0) < 32) {
      result += escapeJSONControlChar(char)
      continue
    }
    result += char
  }
  return result
}

function escapeJSONControlChar(value: string) {
  switch (value) {
    case '\n':
      return '\\n'
    case '\r':
      return '\\r'
    case '\t':
      return '\\t'
    default:
      return `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`
  }
}

function isFenceWhitespace(value: string) {
  return value === ' ' || value === '\t' || value === '\r' || value === '\n'
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }
    const text = value.trim()
    if (text) {
      return text
    }
  }
  return ''
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
