import {
  buildRuntimeRequestHeaders,
  requestRaw,
  resolveRequestUrl,
} from './request'

export type RuntimeStreamFrame<TOutput = Record<string, any>> = {
  request_id?: string
  stream_id?: string
  type?: string
  output?: TOutput
  msg?: string
  status?: number
}

export async function readRuntimeStreamFrame<TOutput = Record<string, any>>(
  api: string,
  requestID: string,
  lastID: string,
  blockMs = 1000
) {
  return (await requestRaw(api, 'get', {
    request_id: requestID,
    last_id: lastID,
    block: blockMs,
  })) as RuntimeStreamFrame<TOutput>
}

export async function readRuntimeStreamEvents<TOutput = Record<string, any>>(
  api: string,
  requestID: string,
  lastID: string,
  blockMs: number,
  onFrame: (frame: RuntimeStreamFrame<TOutput>) => boolean | void,
  signal?: AbortSignal
) {
  const response = await fetch(
    streamRequestUrl(api, {
      request_id: requestID,
      last_id: lastID,
      block: blockMs,
      transport: 'sse',
    }),
    {
      method: 'GET',
      headers: buildRuntimeRequestHeaders({
        accept: 'text/event-stream',
        contentType: false,
      }),
      signal,
    }
  )
  if (!response.ok) {
    throw new Error(`读取运行流失败(${response.status})`)
  }
  if (!response.body) {
    throw new Error('当前浏览器不支持流式读取。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const nextBuffer = consumeSSEBuffer(buffer, (frame) => onFrame(frame as RuntimeStreamFrame<TOutput>))
    if (nextBuffer == null) {
      await reader.cancel()
      return
    }
    buffer = nextBuffer
  }
  buffer += decoder.decode()
  consumeSSEBuffer(buffer, (frame) => onFrame(frame as RuntimeStreamFrame<TOutput>))
}

export function assertRuntimeStreamFrameSuccess(frame: any) {
  if (Number(frame?.status) === 2) {
    throw new Error(streamValueText(frame?.msg) || '请求失败。')
  }
}

function streamRequestUrl(api: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      search.set(key, String(value))
    }
  })
  const url = resolveRequestUrl(api)
  const query = search.toString()
  return query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url
}

function consumeSSEBuffer(
  value: string,
  onFrame: (frame: RuntimeStreamFrame) => boolean | void
) {
  let buffer = value
  for (;;) {
    const index = sseMessageBoundaryIndex(buffer)
    if (index < 0) {
      return buffer
    }
    const raw = buffer.slice(0, index)
    buffer = buffer.slice(skipSSEBoundary(buffer, index))
    const frame = parseSSEFrame(raw)
    if (!frame) {
      continue
    }
    if (onFrame(frame) === false) {
      return null
    }
  }
}

function sseMessageBoundaryIndex(value: string) {
  const lf = value.indexOf('\n\n')
  const crlf = value.indexOf('\r\n\r\n')
  if (lf < 0) {
    return crlf
  }
  if (crlf < 0) {
    return lf
  }
  return Math.min(lf, crlf)
}

function skipSSEBoundary(value: string, index: number) {
  return value.startsWith('\r\n\r\n', index) ? index + 4 : index + 2
}

function parseSSEFrame(raw: string): RuntimeStreamFrame | null {
  const data: string[] = []
  let id = ''
  raw.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith(':')) {
      return
    }
    const separator = line.indexOf(':')
    const field = separator >= 0 ? line.slice(0, separator) : line
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, '') : ''
    if (field === 'id') {
      id = value
    } else if (field === 'data') {
      data.push(value)
    }
  })
  const text = data.join('\n').trim()
  if (!text) {
    return null
  }
  const frame = JSON.parse(text) as RuntimeStreamFrame
  if (id && !frame.stream_id) {
    frame.stream_id = id
  }
  return frame
}

export function streamValueText(value: any) {
  if (value == null) {
    return ''
  }
  return typeof value === 'string' ? value : String(value)
}
