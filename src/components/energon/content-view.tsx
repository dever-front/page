import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import {
  isEmptyRichTextDoc,
  parseRichTextDoc,
  richTextMediaSources,
} from '@/lib/rich-text'
import { RichTextView } from '@/components/rich-text-view'
import { Badge } from '@/components/ui/badge'
import {
  EnergonMediaView,
  isEnergonMediaMetaFlag,
  type EnergonMediaLayout,
  type EnergonMediaActionRenderer,
  type EnergonMediaPreviewHandler,
} from '@/components/energon/media-view'
import { EnergonProgressBlock, normalizeEnergonPercent } from '@/components/energon/progress'
import { normalizeAgentResultOutputValue } from '@/lib/agent-result-protocol'
import { richTextLinkClassName } from '@/lib/rich-text-style'
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
  rich?: any
}

export type ContentViewProps = {
  output?: any
  streaming?: boolean
  emptyText?: string
  className?: string
  markdownClassName?: string
  richClassName?: string
  uploadRules?: ResourceUploadRule[]
  mediaLayout?: EnergonMediaLayout
  mediaPreviewLayerZIndex?: number
  onMediaPreview?: EnergonMediaPreviewHandler
  renderMediaActions?: EnergonMediaActionRenderer
}

export type {
  EnergonMediaActionContext,
  EnergonMediaActionRenderer,
  EnergonMediaKind,
  EnergonMediaPreviewHandler,
  EnergonMediaPreviewItem,
  EnergonMediaPreviewRequest,
} from '@/components/energon/media-view'
export { EnergonAudioPlayer } from '@/components/energon/audio-player'

const outputScalarKeys = [
  'event',
  'title',
  'text',
  'reasoning',
  'progress',
  'error',
  'json',
  'rich',
] as const

const outputListFields = [
  { target: 'images', sources: ['images', 'image'] },
  { target: 'videos', sources: ['videos', 'video'] },
  { target: 'audios', sources: ['audios', 'audio'] },
  { target: 'files', sources: ['files', 'file'] },
] as const

export function ContentView({
  output,
  streaming = false,
  emptyText = '暂无内容。',
  className,
  markdownClassName,
  richClassName,
  uploadRules,
  mediaLayout = 'default',
  mediaPreviewLayerZIndex,
  onMediaPreview,
  renderMediaActions,
}: ContentViewProps) {
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
          streaming={streaming}
          markdownClassName={markdownClassName}
          richClassName={richClassName}
          uploadRules={uploadRules}
          mediaLayout={mediaLayout}
          mediaPreviewLayerZIndex={mediaPreviewLayerZIndex}
          onMediaPreview={onMediaPreview}
          renderMediaActions={renderMediaActions}
        />
      ))}
      {streaming ? <StreamingCursor /> : null}
    </div>
  )
}

export const EnergonContentView = ContentView

export function normalizeEnergonOutput(value: any): EnergonOutput[] {
  if (value == null || value === '') {
    return []
  }
  const values = Array.isArray(value) ? value : [value]
  return values
    .flatMap((item) => {
      const normalized = normalizeAgentResultOutputValue(item)
      return Array.isArray(normalized) ? normalized : [normalized]
    })
    .map(normalizeOutput)
    .filter((item) => !isEmptyOutput(item))
}

function normalizeOutput(value: any): EnergonOutput {
  const directRich = parseRichTextDoc(value)
  if (directRich) {
    return isEmptyRichTextDoc(directRich) ? {} : { rich: directRich }
  }
  if (!isPlainObject(value)) {
    return typeof value === 'string' ? { text: value } : { json: value }
  }

  const output: EnergonOutput = {}
  const content = isPlainObject(value.content) ? value.content : null
  if (content) {
    outputScalarKeys.forEach((key) => copyValue(output, content, key))
  } else if (value.content != null && isEmptyValue(value.text)) {
    output.text = valueText(value.content)
  }
  outputScalarKeys.forEach((key) => copyValue(output, value, key))
  if (isPlainObject(value.meta)) {
    output.meta = value.meta
  } else if (content && isPlainObject(content.meta)) {
    output.meta = content.meta
  }
  outputListFields.forEach((field) => {
    copyList(
      output,
      field.target,
      ...(content ? field.sources.map((source) => content[source]) : []),
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
  streaming,
  markdownClassName,
  richClassName,
  uploadRules,
  mediaLayout,
  mediaPreviewLayerZIndex,
  onMediaPreview,
  renderMediaActions,
}: {
  output: EnergonOutput
  streaming: boolean
  markdownClassName?: string
  richClassName?: string
  uploadRules?: ResourceUploadRule[]
  mediaLayout: EnergonMediaLayout
  mediaPreviewLayerZIndex?: number
  onMediaPreview?: EnergonMediaPreviewHandler
  renderMediaActions?: EnergonMediaActionRenderer
}) {
  const event = valueText(output.event).toLowerCase()
  const isProgressEvent = event === 'start' || event === 'progress'
  const richDoc = parseRichTextDoc(output.rich)
  const hasRich = !isEmptyRichTextDoc(richDoc)
  const outputText = isProgressEvent || hasRich ? '' : valueText(output.text)
  const imageUrls = mediaOutsideRich(
    output.images,
    richTextMediaSources(richDoc, 'image')
  )
  const videoUrls = mediaOutsideRich(
    output.videos,
    richTextMediaSources(richDoc, 'video')
  )
  const audioUrls = mediaOutsideRich(
    output.audios,
    richTextMediaSources(richDoc, 'audio')
  )
  const staleStreamingAudioText =
    !streaming &&
    outputText.trim() === '音频生成中' &&
    audioUrls.length > 0 &&
    (event === 'audio_ready' ||
      isEnergonMediaMetaFlag(output.meta, 'streaming_audio'))
  const text = staleStreamingAudioText ? '' : outputText
  const fileUrls = mediaOutsideRich(output.files, [
    ...normalizeStringList(output.images),
    ...normalizeStringList(output.videos),
    ...normalizeStringList(output.audios),
    ...richTextMediaSources(richDoc, 'image'),
    ...richTextMediaSources(richDoc, 'video'),
    ...richTextMediaSources(richDoc, 'audio'),
  ])

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
      {text ? <MarkdownBlock text={text} className={markdownClassName} /> : null}
      {hasRich ? <RichBlock value={richDoc} className={richClassName} /> : null}
      <ImageBlock
        urls={imageUrls}
        meta={output.meta}
        uploadRules={uploadRules}
        mediaLayout={mediaLayout}
        mediaPreviewLayerZIndex={mediaPreviewLayerZIndex}
        onMediaPreview={onMediaPreview}
        renderMediaActions={renderMediaActions}
      />
      <VideoBlock
        urls={videoUrls}
        meta={output.meta}
        uploadRules={uploadRules}
        mediaLayout={mediaLayout}
        mediaPreviewLayerZIndex={mediaPreviewLayerZIndex}
        onMediaPreview={onMediaPreview}
        renderMediaActions={renderMediaActions}
      />
      <AudioBlock
        urls={audioUrls}
        meta={output.meta}
        uploadRules={uploadRules}
        mediaLayout={mediaLayout}
        mediaPreviewLayerZIndex={mediaPreviewLayerZIndex}
        onMediaPreview={onMediaPreview}
        renderMediaActions={renderMediaActions}
      />
      <FileBlock
        urls={fileUrls}
        meta={output.meta}
        uploadRules={uploadRules}
        mediaLayout={mediaLayout}
        mediaPreviewLayerZIndex={mediaPreviewLayerZIndex}
        onMediaPreview={onMediaPreview}
        renderMediaActions={renderMediaActions}
      />
      {output.json != null ? <JsonFallback value={output.json} event={event} /> : null}
    </div>
  )
}

function MarkdownBlock({ text, className }: { text: string; className?: string }) {
  if (!text) {
    return null
  }
  return (
    <div className={cn(defaultMarkdownClassName, className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={markdownPlugins}
        components={markdownComponents}
      >
        {normalizeMarkdownSource(text)}
      </ReactMarkdown>
    </div>
  )
}

function RichBlock({ value, className }: { value: any; className?: string }) {
  if (!value) {
    return null
  }
  return <RichTextView value={value} className={className} />
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
  mediaLayout,
  mediaPreviewLayerZIndex,
  onMediaPreview,
  renderMediaActions,
}: {
  urls: string[]
  meta?: Record<string, any>
  uploadRules?: ResourceUploadRule[]
  mediaLayout: EnergonMediaLayout
  mediaPreviewLayerZIndex?: number
  onMediaPreview?: EnergonMediaPreviewHandler
  renderMediaActions?: EnergonMediaActionRenderer
}) {
  if (urls.length === 0) {
    return null
  }
  return (
    <EnergonMediaView
      kind="image"
      urls={urls}
      meta={meta}
      uploadRules={uploadRules}
      layout={mediaLayout}
      previewLayerZIndex={mediaPreviewLayerZIndex}
      onMediaPreview={onMediaPreview}
      renderMediaActions={renderMediaActions}
    />
  )
}

function VideoBlock({
  urls,
  meta,
  uploadRules,
  mediaLayout,
  mediaPreviewLayerZIndex,
  onMediaPreview,
  renderMediaActions,
}: {
  urls: string[]
  meta?: Record<string, any>
  uploadRules?: ResourceUploadRule[]
  mediaLayout: EnergonMediaLayout
  mediaPreviewLayerZIndex?: number
  onMediaPreview?: EnergonMediaPreviewHandler
  renderMediaActions?: EnergonMediaActionRenderer
}) {
  if (urls.length === 0) {
    return null
  }
  return (
    <EnergonMediaView
      kind="video"
      urls={urls}
      meta={meta}
      uploadRules={uploadRules}
      layout={mediaLayout}
      previewLayerZIndex={mediaPreviewLayerZIndex}
      onMediaPreview={onMediaPreview}
      renderMediaActions={renderMediaActions}
    />
  )
}

function AudioBlock({
  urls,
  meta,
  uploadRules,
  mediaLayout,
  mediaPreviewLayerZIndex,
  onMediaPreview,
  renderMediaActions,
}: {
  urls: string[]
  meta?: Record<string, any>
  uploadRules?: ResourceUploadRule[]
  mediaLayout: EnergonMediaLayout
  mediaPreviewLayerZIndex?: number
  onMediaPreview?: EnergonMediaPreviewHandler
  renderMediaActions?: EnergonMediaActionRenderer
}) {
  if (urls.length === 0) {
    return null
  }
  return (
    <EnergonMediaView
      kind="audio"
      urls={urls}
      meta={meta}
      uploadRules={uploadRules}
      layout={mediaLayout}
      previewLayerZIndex={mediaPreviewLayerZIndex}
      onMediaPreview={onMediaPreview}
      renderMediaActions={renderMediaActions}
    />
  )
}

function FileBlock({
  urls,
  meta,
  uploadRules,
  mediaLayout,
  mediaPreviewLayerZIndex,
  onMediaPreview,
  renderMediaActions,
}: {
  urls: string[]
  meta?: Record<string, any>
  uploadRules?: ResourceUploadRule[]
  mediaLayout: EnergonMediaLayout
  mediaPreviewLayerZIndex?: number
  onMediaPreview?: EnergonMediaPreviewHandler
  renderMediaActions?: EnergonMediaActionRenderer
}) {
  if (urls.length === 0) {
    return null
  }
  return (
    <EnergonMediaView
      kind="file"
      urls={urls}
      meta={meta}
      uploadRules={uploadRules}
      layout={mediaLayout}
      previewLayerZIndex={mediaPreviewLayerZIndex}
      onMediaPreview={onMediaPreview}
      renderMediaActions={renderMediaActions}
    />
  )
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

const defaultMarkdownClassName = cn(
  'min-w-0 text-sm leading-7 text-foreground',
  richTextLinkClassName,
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em]',
  '[&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold',
  '[&_h2]:mb-2.5 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold',
  '[&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_h4]:mb-1.5 [&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-semibold',
  '[&_h5]:mb-1.5 [&_h5]:mt-3 [&_h5]:text-sm [&_h5]:font-medium',
  '[&_h6]:mb-1.5 [&_h6]:mt-3 [&_h6]:text-xs [&_h6]:font-medium [&_h6]:text-muted-foreground',
  '[&_hr]:my-4 [&_hr]:border-border',
  '[&_img]:my-4 [&_img]:block [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted/60',
  '[&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_strong]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6'
)

const markdownPlugins = [remarkGfm, remarkBreaks]

const markdownComponents: Components = {
  a({ children, node, ...props }) {
    void node
    return (
      <a {...props} target="_blank" rel="noreferrer">
        {children}
      </a>
    )
  },
}

function normalizeMarkdownSource(value: unknown) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(
      /(^|\n)([ \t\u00a0\u3000]{0,3})(#{1,6})(?!#)([ \t\u00a0\u3000]*)(?=\S)/g,
      normalizeMarkdownHeadingMarker
    )
}

function normalizeMarkdownHeadingMarker(
  match: string,
  start: string,
  indent: string,
  marker: string,
  gap: string
) {
  if (marker.length === 1 && gap.length === 0) {
    return match
  }
  return `${start}${indent}${marker} `
}

function copyValue(
  target: EnergonOutput,
  source: Record<string, any>,
  key: keyof EnergonOutput
) {
  if (!(key in source) || isEmptyValue(source[key])) {
    return
  }
  const writable = target as Record<string, any>
  writable[key] = source[key]
}

function copyList(target: EnergonOutput, key: keyof EnergonOutput, ...values: any[]) {
  const result = values.flatMap((value) => normalizeMediaList(key, value))
  if (result.length === 0) {
    return
  }
  const writable = target as Record<string, any>
  writable[key] = result
}

function normalizeMediaList(key: keyof EnergonOutput, value: any): string[] {
  const field = mediaFieldConfig[key]
  if (!field) {
    return normalizeStringList(value)
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeMediaList(key, item))
  }
  if (isPlainObject(value)) {
    const result: string[] = []
    for (const source of field.sources) {
      result.push(...normalizeMediaList(key, value[source]))
    }
    for (const nested of ['output', 'data', 'content']) {
      result.push(...normalizeMediaList(key, value[nested]))
    }
    return uniqueStrings(result)
  }

  const text = valueText(value).trim()
  if (!text) {
    return []
  }
  if (looksLikeJSON(text)) {
    try {
      const parsed = JSON.parse(text)
      const result = normalizeMediaList(key, parsed)
      if (result.length > 0) {
        return result
      }
      return []
    } catch {
      // fall through and treat it as a plain URL/string
    }
  }
  return [text]
}

function normalizeStringList(value: any) {
  if (Array.isArray(value)) {
    return value.map(valueText).filter(Boolean)
  }
  const text = valueText(value)
  return text ? [text] : []
}

function mediaOutsideRich(value: any, richUrls: string[]) {
  const urls = normalizeStringList(value)
  if (urls.length === 0 || richUrls.length === 0) {
    return urls
  }
  const used = new Set(richUrls.map((url) => url.trim()).filter(Boolean))
  return urls.filter((url) => !used.has(url.trim()))
}

const mediaFieldConfig: Partial<Record<keyof EnergonOutput, { sources: string[] }>> = {
  images: {
    sources: [
      'images',
      'image',
      'url',
      'image_url',
      'first_frame_url',
      'last_frame_url',
      'cover_url',
      'thumbnail_url',
    ],
  },
  videos: {
    sources: ['videos', 'video', 'url', 'video_url'],
  },
  audios: {
    sources: ['audios', 'audio', 'url', 'audio_url'],
  },
  files: {
    sources: ['files', 'file', 'url', 'file_url'],
  },
}

function looksLikeJSON(value: string) {
  return value.startsWith('{') || value.startsWith('[')
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = String(value || '').trim()
    if (!text || seen.has(text)) {
      continue
    }
    seen.add(text)
    result.push(text)
  }
  return result
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
