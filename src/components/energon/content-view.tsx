import { Badge } from '@/components/ui/badge'
import { EnergonMediaView } from '@/components/energon/media-view'
import { EnergonProgressBlock, normalizeEnergonPercent } from '@/components/energon/progress'
import type { ResourceUploadRule } from '@/lib/resource'
import { cn } from '@/lib/utils'

export type EnergonOutput = {
  event?: string
  title?: any
  text?: any
  reasoning?: any
  images?: any
  videos?: any
  audios?: any
  files?: any
  progress?: any
  meta?: Record<string, any>
  error?: any
  json?: any
  html?: any
  rich?: any
}

type EnergonContentViewProps = {
  output?: any
  streaming?: boolean
  emptyText?: string
  className?: string
  uploadRules?: ResourceUploadRule[]
}

const outputScalarKeys = [
  'event',
  'title',
  'text',
  'reasoning',
  'progress',
  'error',
  'json',
  'html',
  'rich',
] as const

const outputListFields = [
  { target: 'images', sources: ['images', 'image'] },
  { target: 'videos', sources: ['videos', 'video'] },
  { target: 'audios', sources: ['audios', 'audio'] },
  { target: 'files', sources: ['files', 'file'] },
] as const

export function EnergonContentView({
  output,
  streaming = false,
  emptyText = '暂无内容。',
  className,
  uploadRules,
}: EnergonContentViewProps) {
  const items = normalizeEnergonOutput(output)

  if (items.length === 0 && !streaming) {
    return <div className="text-sm text-muted-foreground">{emptyText}</div>
  }

  return (
    <div className={cn('space-y-4', className)}>
      {items.map((item, index) => (
        <EnergonOutputBlock
          key={`${item.event || 'output'}-${index}`}
          output={item}
          uploadRules={uploadRules}
        />
      ))}
      {streaming ? <StreamingCursor /> : null}
    </div>
  )
}

export function normalizeEnergonOutput(value: any): EnergonOutput[] {
  if (value == null || value === '') {
    return []
  }
  const values = Array.isArray(value) ? value : [value]
  return values.map(normalizeOutput).filter((item) => !isEmptyOutput(item))
}

function normalizeOutput(value: any): EnergonOutput {
  if (!isPlainObject(value)) {
    return typeof value === 'string' ? { text: value } : { json: value }
  }

  const output: EnergonOutput = {}
  outputScalarKeys.forEach((key) => copyValue(output, value, key))
  if (isPlainObject(value.meta)) {
    output.meta = value.meta
  }
  outputListFields.forEach((field) => {
    copyList(
      output,
      field.target,
      ...field.sources.map((source) => value[source])
    )
  })

  if (Object.keys(output).length === 0) {
    output.json = value
  }
  return output
}

function EnergonOutputBlock({
  output,
  uploadRules,
}: {
  output: EnergonOutput
  uploadRules?: ResourceUploadRule[]
}) {
  const event = valueText(output.event).toLowerCase()
  const isProgressEvent = event === 'start' || event === 'progress'
  const text = isProgressEvent ? '' : valueText(output.text)

  if (event === 'end' && !output.text && !output.error) {
    return null
  }

  return (
    <div className="space-y-4">
      {isProgressEvent ? <ProgressBlock output={output} /> : null}
      {output.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {valueText(output.error)}
        </div>
      ) : null}
      {output.title ? (
        <h3 className="text-base font-semibold leading-7">{valueText(output.title)}</h3>
      ) : null}
      {output.reasoning ? <ReasoningBlock text={valueText(output.reasoning)} /> : null}
      {text ? <MarkdownBlock text={text} /> : null}
      {output.html || output.rich ? <RichBlock html={valueText(output.html || output.rich)} /> : null}
      <ImageBlock urls={normalizeStringList(output.images)} meta={output.meta} uploadRules={uploadRules} />
      <VideoBlock urls={normalizeStringList(output.videos)} uploadRules={uploadRules} />
      <AudioBlock urls={normalizeStringList(output.audios)} uploadRules={uploadRules} />
      <FileBlock urls={normalizeStringList(output.files)} uploadRules={uploadRules} />
      {output.json != null ? <JsonFallback value={output.json} event={event} /> : null}
    </div>
  )
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) {
    return null
  }
  return (
    <div
      className={richTextClassName}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  )
}

function RichBlock({ html }: { html: string }) {
  if (!html) {
    return null
  }
  return <div className={richTextClassName} dangerouslySetInnerHTML={{ __html: html }} />
}

function ReasoningBlock({ text }: { text: string }) {
  if (!text) {
    return null
  }
  return (
    <div className="rounded-lg border bg-muted/35 p-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">推理</div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{text}</div>
    </div>
  )
}

function ProgressBlock({ output }: { output: EnergonOutput }) {
  const message = valueText(output.text) || '处理中...'
  const percent = normalizeEnergonPercent(output.progress ?? output.meta?.progress ?? output.meta?.percent)
  return <EnergonProgressBlock message={message} percent={percent} />
}

function ImageBlock({
  urls,
  meta,
  uploadRules,
}: {
  urls: string[]
  meta?: Record<string, any>
  uploadRules?: ResourceUploadRule[]
}) {
  if (urls.length === 0) {
    return null
  }
  return <EnergonMediaView kind="image" urls={urls} meta={meta} uploadRules={uploadRules} />
}

function VideoBlock({
  urls,
  uploadRules,
}: {
  urls: string[]
  uploadRules?: ResourceUploadRule[]
}) {
  if (urls.length === 0) {
    return null
  }
  return <EnergonMediaView kind="video" urls={urls} uploadRules={uploadRules} />
}

function AudioBlock({
  urls,
  uploadRules,
}: {
  urls: string[]
  uploadRules?: ResourceUploadRule[]
}) {
  if (urls.length === 0) {
    return null
  }
  return <EnergonMediaView kind="audio" urls={urls} uploadRules={uploadRules} />
}

function FileBlock({
  urls,
  uploadRules,
}: {
  urls: string[]
  uploadRules?: ResourceUploadRule[]
}) {
  if (urls.length === 0) {
    return null
  }
  return <EnergonMediaView kind="file" urls={urls} uploadRules={uploadRules} />
}

function JsonFallback({ value, event }: { value: any; event: string }) {
  return (
    <div className="space-y-2">
      {event ? (
        <Badge variant="outline" className="text-muted-foreground">
          {event}
        </Badge>
      ) : null}
      <pre
        className={cn(
          'max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs leading-5',
          'whitespace-pre-wrap break-words'
        )}
      >
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function StreamingCursor() {
  return <span className="inline-block h-4 w-1 animate-pulse bg-primary align-[-2px]" />
}

const richTextClassName = cn(
  'min-w-0 text-sm leading-7 text-foreground',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em]',
  '[&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold',
  '[&_h2]:mb-2.5 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold',
  '[&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted/60',
  '[&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6'
)

function renderMarkdown(markdown: string) {
  const codeBlocks: string[] = []
  const inlineCodes: string[] = []
  let source = markdown.replace(/\r\n/g, '\n')

  source = source.replace(/```([\s\S]*?)```/g, (_, code) => {
    const index = codeBlocks.length
    codeBlocks.push(`<pre><code>${escapeHtml(String(code).replace(/^\n|\n$/g, ''))}</code></pre>`)
    return `\n\n@@CODE_BLOCK_${index}@@\n\n`
  })

  source = escapeHtml(source)
  source = source.replace(/`([^`\n]+)`/g, (_, code) => {
    const index = inlineCodes.length
    inlineCodes.push(`<code>${code}</code>`)
    return `@@INLINE_CODE_${index}@@`
  })

  const blocks = source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => renderMarkdownBlock(block))
    .join('\n')

  return restorePlaceholders(blocks, codeBlocks, 'CODE_BLOCK').replace(
    /@@INLINE_CODE_(\d+)@@/g,
    (_, index) => inlineCodes[Number(index)] || ''
  )
}

function renderMarkdownBlock(block: string) {
  const codeBlock = block.match(/^@@CODE_BLOCK_(\d+)@@$/)
  if (codeBlock) {
    return block
  }

  const heading = block.match(/^(#{1,6})\s+(.+)$/)
  if (heading) {
    const level = Math.min(3, heading[1].length)
    return `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`
  }

  const lines = block.split('\n')
  if (lines.every((line) => /^\s*[-*+]\s+/.test(line))) {
    return `<ul>${lines
      .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ''))}</li>`)
      .join('')}</ul>`
  }
  if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
    return `<ol>${lines
      .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*\d+\.\s+/, ''))}</li>`)
      .join('')}</ol>`
  }
  if (lines.every((line) => /^\s*&gt;\s?/.test(line))) {
    return `<blockquote>${lines
      .map((line) => renderInlineMarkdown(line.replace(/^\s*&gt;\s?/, '')))
      .join('<br/>')}</blockquote>`
  }

  return `<p>${lines.map(renderInlineMarkdown).join('<br/>')}</p>`
}

function renderInlineMarkdown(value: string) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const href = safeHref(url)
      return `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`
    })
}

function restorePlaceholders(value: string, replacements: string[], key: string) {
  return value.replace(new RegExp(`@@${key}_(\\d+)@@`, 'g'), (_, index) => {
    return replacements[Number(index)] || ''
  })
}

function safeHref(value: string) {
  const href = String(value || '').trim()
  if (/^(https?:|mailto:|\/)/i.test(href)) {
    return escapeHtml(href)
  }
  return '#'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function copyValue(target: EnergonOutput, source: Record<string, any>, key: keyof EnergonOutput) {
  if (!(key in source) || isEmptyValue(source[key])) {
    return
  }
  const writable = target as Record<string, any>
  writable[key] = source[key]
}

function copyList(target: EnergonOutput, key: keyof EnergonOutput, ...values: any[]) {
  const result = values.flatMap(normalizeStringList)
  if (result.length === 0) {
    return
  }
  const writable = target as Record<string, any>
  writable[key] = result
}

function normalizeStringList(value: any) {
  if (Array.isArray(value)) {
    return value.map(valueText).filter(Boolean)
  }
  const text = valueText(value)
  return text ? [text] : []
}

function isPlainObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isEmptyOutput(output: EnergonOutput) {
  return Object.keys(output).length === 0
}

function isEmptyValue(value: any) {
  if (value == null) {
    return true
  }
  if (typeof value === 'string') {
    return value.length === 0
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return false
}

function valueText(value: any) {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value, null, 2) ?? String(value)
}
