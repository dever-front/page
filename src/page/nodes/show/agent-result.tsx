import type { ReactNode } from 'react'
import {
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { streamValueText as valueText } from '@/lib/stream'
import { isPlainRecord as isPlainObject } from '@/lib/runtime-stream-output'
import {
  EnergonContentView,
  type EnergonOutput,
} from '@/components/energon/content-view'
import { EnergonProgressBlock } from '@/components/energon/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type AgentResultOutput = EnergonOutput & {
  kind?: string
  type?: string
  content?: unknown
  suggestions?: unknown
  result_id?: unknown
  result_mode?: unknown
  display_mode?: unknown
  result?: unknown
  tasks?: unknown
  progress_text?: unknown
}

export type AgentResultTask = {
  id: string
  placeholderID: string
  title: string
  kind: string
  power: string
  execution: 'async' | 'sync' | string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | string
  text: string
  error: string
  progress: number | null
  output?: AgentResultOutput
  sort: number
}

export type AgentResultDetail = {
  id: string
  title: string
  mode: string
  result?: AgentResultOutput
  tasks: AgentResultTask[]
  progress: number | null
  progressText: string
}

export function AgentResultCard({
  detail,
  running,
  onOpen,
}: {
  detail: AgentResultDetail
  running?: boolean
  onOpen: () => void
}) {
  const runningTasks = detail.tasks.filter((task) => task.status === 'running')
  const failedTasks = detail.tasks.filter((task) => task.status === 'failed')
  const doneTasks = detail.tasks.filter((task) => task.status === 'succeeded')
  const taskText =
    detail.tasks.length > 0
      ? `素材 ${doneTasks.length}/${detail.tasks.length}${failedTasks.length ? `，失败 ${failedTasks.length}` : ''}`
      : '正文已生成'

  return (
    <button
      type='button'
      className='block w-full rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40'
      onClick={onOpen}
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>内容已生成</div>
          <div className='mt-0.5 truncate text-xs text-muted-foreground'>
            {running && runningTasks.length > 0
              ? `正在生成：${runningTasks[0].title}`
              : taskText}
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-2 text-xs text-primary'>
          {running ? <Loader2 className='size-3.5 animate-spin' /> : null}
          查看结果
          <ExternalLink className='size-3.5' />
        </div>
      </div>
    </button>
  )
}

export function AgentResultDrawer({
  open,
  detail,
  running,
  suggestions,
  onOpenChange,
}: {
  open: boolean
  detail?: AgentResultDetail | null
  running: boolean
  suggestions?: ReactNode
  onOpenChange: (open: boolean) => void
}) {
  const title = detail?.title || '最终结果'
  const output = detail?.result
    ? applyResultTaskPlaceholders(detail.result, detail.tasks)
    : undefined
  const progressText = visibleProgressText(detail?.progressText)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='flex w-[92vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl'
      >
        <SheetHeader className='border-b px-5 py-4 text-start'>
          <SheetTitle className='truncate'>{title}</SheetTitle>
          <SheetDescription>
            {running ? '内容和素材仍在更新。' : '最终结果可在这里完整查看。'}
          </SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 overflow-y-auto px-5 py-4'>
          {progressText ? (
            <div className='mb-4'>
              <EnergonProgressBlock
                message={progressText}
                percent={detail.progress}
              />
            </div>
          ) : null}
          {output ? (
            <EnergonContentView output={output} emptyText='暂无结果内容。' />
          ) : (
            <div className='rounded-md border bg-muted/25 px-3 py-2 text-sm text-muted-foreground'>
              正在准备结果内容。
            </div>
          )}
        </div>
        {suggestions ? <div className='border-t px-5 py-3'>{suggestions}</div> : null}
      </SheetContent>
    </Sheet>
  )
}

function visibleProgressText(value: unknown) {
  const text = valueText(value).trim()
  return text === '内容已生成，点击查看结果。' ? '' : text
}

export function applyResultTaskPlaceholders(
  output: AgentResultOutput,
  tasks: AgentResultTask[]
): AgentResultOutput {
  if (tasks.length === 0) {
    return output
  }
  const byPlaceholder = new Map<string, AgentResultTask>()
  tasks.forEach((task) => {
    if (task.placeholderID) {
      byPlaceholder.set(task.placeholderID, task)
    }
    byPlaceholder.set(task.id, task)
  })
  const next: AgentResultOutput = { ...output }
  const rich = enrichResultPlaceholders(next.rich, byPlaceholder)
  if (rich) {
    next.rich = rich
  }
  if (isPlainObject(next.content)) {
    const content = { ...next.content }
    const contentRich = enrichResultPlaceholders(content.rich, byPlaceholder)
    if (contentRich) {
      content.rich = contentRich
      next.content = content
    }
  }
  return next
}

function enrichResultPlaceholders(
  value: unknown,
  tasks: Map<string, AgentResultTask>
): unknown {
  if (!isPlainObject(value)) {
    return value
  }
  const nodes = enrichResultPlaceholderNode(value, tasks)
  return nodes.length === 1 ? nodes[0] : value
}

function enrichResultPlaceholderNode(
  node: Record<string, unknown>,
  tasks: Map<string, AgentResultTask>
): Record<string, unknown>[] {
  const type = valueText(node.type)
  const next: Record<string, unknown> = { ...node }
  if (type === 'agentAbilityPlaceholder' || type === 'agentTaskPlaceholder') {
    const attrs = isPlainObject(node.attrs) ? { ...node.attrs } : {}
    const placeholderID = valueText(
      attrs.placeholder_id || attrs.placeholderId || attrs.id
    )
    const task = tasks.get(placeholderID)
    if (task) {
      const outputNodes = resultTaskOutputNodes(task)
      if (outputNodes.length > 0) {
        return outputNodes
      }
      next.attrs = {
        ...attrs,
        status: task.status,
        progress: task.progress,
        title: task.title,
        kind: task.kind,
        text: task.text,
        error: task.error,
      }
    }
    return [next]
  }
  if (Array.isArray(node.content)) {
    const content: unknown[] = []
    node.content.forEach((child) => {
      if (isPlainObject(child)) {
        content.push(...enrichResultPlaceholderNode(child, tasks))
      } else {
        content.push(child)
      }
    })
    next.content = content
  }
  return [next]
}

function resultTaskOutputNodes(task: AgentResultTask): Record<string, unknown>[] {
  if (task.status !== 'succeeded' || !task.output) {
    return []
  }
  const kind = task.kind.toLowerCase()
  if (kind === 'image' || kind === 'images' || kind === 'cover') {
    const nodes = mediaNodes(
      'editorMediaImage',
      resultTaskMediaURLs(task.output, 'images', 'image'),
      task.title
    )
    if (nodes.length > 0) {
      return nodes
    }
  }
  if (kind === 'video' || kind === 'videos') {
    const nodes = mediaNodes(
      'editorMediaVideo',
      resultTaskMediaURLs(task.output, 'videos', 'video'),
      task.title
    )
    if (nodes.length > 0) {
      return nodes
    }
  }
  if (kind === 'audio' || kind === 'audios' || kind === 'song' || kind === 'music') {
    const nodes = mediaNodes(
      'editorMediaAudio',
      resultTaskMediaURLs(task.output, 'audios', 'audio'),
      task.title
    )
    if (nodes.length > 0) {
      return [...nodes, ...resultTaskTextNodes(task.output)]
    }
  }
  const media = [
    ...mediaNodes(
      'editorMediaImage',
      resultTaskMediaURLs(task.output, 'images', 'image'),
      task.title
    ),
    ...mediaNodes(
      'editorMediaVideo',
      resultTaskMediaURLs(task.output, 'videos', 'video'),
      task.title
    ),
    ...mediaNodes(
      'editorMediaAudio',
      resultTaskMediaURLs(task.output, 'audios', 'audio'),
      task.title
    ),
  ]
  if (media.length > 0) {
    return media
  }
  const richNodes = resultTaskRichNodes(task.output)
  if (richNodes.length > 0) {
    return richNodes
  }
  const text = resultTaskOutputText(task.output)
  if (text) {
    return textNodes(text)
  }
  return []
}

function mediaNodes(type: string, urls: string[], title: string): Record<string, unknown>[] {
  return urls.map((url) => ({
    type,
    attrs: {
      src: url,
      title,
      alt: title,
    },
  }))
}

function resultTaskMediaURLs(
  output: AgentResultOutput,
  pluralKey: string,
  singleKey: string
) {
  const content = isPlainObject(output.content) ? output.content : {}
  return uniqueTextValues([
    ...stringList(content[pluralKey]),
    ...stringList(content[singleKey]),
    ...stringList(output[pluralKey as keyof AgentResultOutput]),
    ...stringList(output[singleKey as keyof AgentResultOutput]),
  ])
}

function resultTaskRichNodes(output: AgentResultOutput): Record<string, unknown>[] {
  const content = isPlainObject(output.content) ? output.content : {}
  const rich = isPlainObject(output.rich)
    ? output.rich
    : isPlainObject(content.rich)
      ? content.rich
      : null
  if (!rich || valueText(rich.type) !== 'doc' || !Array.isArray(rich.content)) {
    return []
  }
  return rich.content.filter((node): node is Record<string, unknown> =>
    isPlainObject(node)
  )
}

function resultTaskOutputText(output: AgentResultOutput) {
  const content = isPlainObject(output.content) ? output.content : {}
  const record = output as Record<string, unknown>
  return valueText(
    output.text ||
      content.text ||
      record.lyrics ||
      content.lyrics ||
      record.lyric ||
      content.lyric ||
      record.lrc ||
      content.lrc ||
      record.song_lyrics ||
      content.song_lyrics ||
      record.songLyrics ||
      content.songLyrics ||
      output.title ||
      content.title
  ).trim()
}

function resultTaskTextNodes(output: AgentResultOutput) {
  const richNodes = resultTaskRichNodes(output)
  if (richNodes.length > 0) {
    return richNodes
  }
  const text = resultTaskOutputText(output)
  return text ? textNodes(text) : []
}

function textNodes(text: string): Record<string, unknown>[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      content: inlineTextNodes(paragraph),
    }))
}

function inlineTextNodes(text: string): Record<string, unknown>[] {
  const lines = text.split(/\n/)
  const nodes: Record<string, unknown>[] = []
  lines.forEach((line, index) => {
    if (index > 0) {
      nodes.push({ type: 'hardBreak' })
    }
    if (line) {
      nodes.push({ type: 'text', text: line })
    }
  })
  return nodes
}

function stringList(value: unknown): string[] {
  if (value == null) {
    return []
  }
  if (typeof value === 'string') {
    const text = value.trim()
    return text ? [text] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringList(item))
  }
  if (isPlainObject(value)) {
    for (const key of ['url', 'src', 'uri', 'href']) {
      const text = valueText(value[key]).trim()
      if (text) {
        return [text]
      }
    }
  }
  const text = valueText(value).trim()
  return text ? [text] : []
}

function uniqueTextValues(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    const text = value.trim()
    if (!text || seen.has(text)) {
      return
    }
    seen.add(text)
    result.push(text)
  })
  return result
}
