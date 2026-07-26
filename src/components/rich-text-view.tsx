import {
  Fragment,
  type CSSProperties,
  createElement,
  type ReactNode,
  useLayoutEffect,
  useMemo,
} from 'react'
import {
  isEmptyRichTextDoc,
  normalizeRichTextMaxWidth,
  parseRichTextDoc,
  richTextExternalMediaNodeName,
  richTextMediaNodeNames,
  type RichTextMark,
  type RichTextNode,
} from '@/lib/rich-text'
import {
  richTextBlockStyleToCss,
  richTextTextStyleToCss,
} from '@/lib/rich-text-style'
import {
  normalizeRichTextMediaCaption,
  richTextContentClassName,
  richTextMediaCaptionClassName,
  richTextPreviewClassName,
} from '@/lib/rich-text-html'
import { safeRichTextHref } from '@/lib/rich-text-link'
import { cn } from '@/lib/utils'

export type RichTextOutlineItem = {
  id: string
  level: number
  text: string
}

export type RichTextOutlineOptions = {
  minLevel?: number
  maxLevel?: number
  idPrefix?: string
}

type RichTextViewProps = {
  value: unknown
  className?: string
  preview?: boolean
  outline?: RichTextOutlineOptions
  onOutlineChange?: (items: RichTextOutlineItem[]) => void
}

type RichTextOutline = {
  items: RichTextOutlineItem[]
  headingIDs: ReadonlyMap<string, string>
}

const EMPTY_RICH_TEXT_OUTLINE: RichTextOutline = {
  items: [],
  headingIDs: new Map(),
}

export function RichTextView({
  value,
  className,
  preview,
  outline,
  onOutlineChange,
}: RichTextViewProps) {
  const doc = useMemo(() => parseRichTextDoc(value), [value])
  const outlineEnabled = outline != null
  const outlineMinLevel = normalizeHeadingLevel(outline?.minLevel, 2)
  const outlineMaxLevel = Math.max(outlineMinLevel, normalizeHeadingLevel(outline?.maxLevel, 3))
  const outlineIDPrefix = normalizeOutlineIDPrefix(outline?.idPrefix)
  const resolvedOutline = useMemo(
    () =>
      createRichTextOutline(doc, outlineEnabled, outlineMinLevel, outlineMaxLevel, outlineIDPrefix),
    [doc, outlineEnabled, outlineIDPrefix, outlineMaxLevel, outlineMinLevel]
  )

  useLayoutEffect(() => {
    onOutlineChange?.(resolvedOutline.items)
  }, [onOutlineChange, resolvedOutline.items])

  if (!doc || isEmptyRichTextDoc(doc)) {
    return null
  }

  return (
    <div className={cn(richTextContentClassName, preview && richTextPreviewClassName, className)}>
      {renderRichTextDoc(doc, resolvedOutline.headingIDs)}
    </div>
  )
}

function renderRichTextDoc(doc: RichTextNode, headingIDs: ReadonlyMap<string, string>) {
  return renderRichTextChildren(doc, 'doc', headingIDs)
}

function renderRichTextChildren(
  node: RichTextNode,
  key: string,
  headingIDs: ReadonlyMap<string, string>
): ReactNode {
  if (!Array.isArray(node.content)) {
    return null
  }
  return node.content.map((child, index) =>
    renderRichTextNode(child, `${key}-${index}`, headingIDs)
  )
}

function renderRichTextNode(
  node: RichTextNode | null | undefined,
  key: string,
  headingIDs: ReadonlyMap<string, string>
): ReactNode {
  if (!node || typeof node.type !== 'string') {
    return null
  }

  const children = renderRichTextChildren(node, key, headingIDs)
  switch (node.type) {
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>
    case 'bulletList':
      return <ul key={key}>{children}</ul>
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      )
    case 'doc':
      return <Fragment key={key}>{children}</Fragment>
    case 'hardBreak':
      return <br key={key} />
    case 'heading':
      return createElement(
        headingTag(node),
        { key, id: headingIDs.get(key), style: blockStyle(node) },
        children
      )
    case 'articleBlock':
      return <div key={key} style={blockStyle(node)}>{children}</div>
    case 'horizontalRule':
      return <hr key={key} />
    case 'listItem':
      return <li key={key} style={blockStyle(node)}>{children}</li>
    case 'orderedList':
      return <ol key={key}>{children}</ol>
    case 'paragraph':
      return <p key={key} style={blockStyle(node)}>{children}</p>
    case 'agentAbilityPlaceholder':
    case 'agentTaskPlaceholder':
      return renderRichTextPlaceholder(node, key)
    case 'table':
      return <table key={key}>{children}</table>
    case 'tableCell':
      return <td key={key} style={blockStyle(node)}>{children}</td>
    case 'tableHeader':
      return <th key={key} style={blockStyle(node)}>{children}</th>
    case 'tableRow':
      return <tr key={key}>{children}</tr>
    case 'text':
      return renderRichTextText(node, key)
    case richTextMediaNodeNames.image:
      return renderRichTextImage(node, key)
    case richTextMediaNodeNames.video:
      return renderRichTextVideo(node, key)
    case richTextMediaNodeNames.audio:
      return renderRichTextAudio(node, key)
    case richTextExternalMediaNodeName:
      return renderRichTextExternalMedia(node, key)
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

function renderRichTextText(node: RichTextNode, key: string): ReactNode {
  const text = node.text || ''
  const content = <Fragment key={`${key}-text`}>{text}</Fragment>
  if (!Array.isArray(node.marks) || node.marks.length === 0) {
    return content
  }
  return node.marks.reduceRight<ReactNode>(
    (children, mark, index) => renderRichTextMark(mark, children, `${key}-mark-${index}`),
    content
  )
}

function renderRichTextMark(mark: RichTextMark | null | undefined, children: ReactNode, key: string) {
  if (!mark || typeof mark.type !== 'string') {
    return <Fragment key={key}>{children}</Fragment>
  }

  switch (mark.type) {
    case 'bold':
      return <strong key={key}>{children}</strong>
    case 'code':
      return <code key={key}>{children}</code>
    case 'italic':
      return <em key={key}>{children}</em>
    case 'link':
      return (
        <a key={key} href={safeRichTextHref(mark.attrs?.href)} target="_blank" rel="noreferrer">
          {children}
        </a>
      )
    case 'strike':
      return <s key={key}>{children}</s>
    case 'textStyle':
      return renderTextStyleMark(mark, children, key)
    case 'underline':
      return <u key={key}>{children}</u>
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

function renderTextStyleMark(mark: RichTextMark, children: ReactNode, key: string) {
  const style = richTextTextStyleToCss(mark.attrs) as CSSProperties
  if (Object.keys(style).length === 0) {
    return <Fragment key={key}>{children}</Fragment>
  }
  return (
    <span key={key} style={style}>
      {children}
    </span>
  )
}

function renderRichTextImage(node: RichTextNode, key: string) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return null
  }
  const caption = normalizeRichTextMediaCaption(node.attrs?.caption)
  if (caption) {
    return (
      <figure key={key} className="my-4 max-w-full" style={attrs.style}>
        <img
          src={attrs.src}
          alt={String(node.attrs?.alt || '')}
          title={String(node.attrs?.title || '')}
          style={{ margin: 0, maxWidth: '100%' }}
        />
        {renderMediaCaption(caption)}
      </figure>
    )
  }
  return (
    <img
      key={key}
      src={attrs.src}
      alt={String(node.attrs?.alt || '')}
      title={String(node.attrs?.title || '')}
      style={attrs.style}
    />
  )
}

function renderRichTextVideo(node: RichTextNode, key: string) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return null
  }
  const caption = normalizeRichTextMediaCaption(node.attrs?.caption)
  if (caption) {
    return (
      <figure key={key} className="my-4 max-w-full" style={attrs.style}>
        <video
          src={attrs.src}
          controls
          preload="metadata"
          playsInline
          style={{ margin: 0, maxWidth: '100%' }}
        />
        {renderMediaCaption(caption)}
      </figure>
    )
  }
  return (
    <video
      key={key}
      src={attrs.src}
      controls
      preload="metadata"
      playsInline
      style={attrs.style}
    />
  )
}

function renderRichTextAudio(node: RichTextNode, key: string) {
  const attrs = mediaAttrs(node)
  if (!attrs.src) {
    return null
  }
  const caption = normalizeRichTextMediaCaption(node.attrs?.caption)
  if (caption) {
    return (
      <figure key={key} className="my-4 max-w-full" style={attrs.style}>
        <audio src={attrs.src} controls preload="none" className="block w-full" />
        {renderMediaCaption(caption)}
      </figure>
    )
  }
  return <audio key={key} src={attrs.src} controls preload="none" style={attrs.style} />
}

function renderRichTextExternalMedia(node: RichTextNode, key: string) {
  const src = String(node.attrs?.src || node.attrs?.href || '').trim()
  if (!src) {
    return null
  }
  const kind = String(node.attrs?.kind || '').trim().toLowerCase() === 'audio' ? 'audio' : 'video'
  const title =
    String(node.attrs?.title || '').trim() || (kind === 'audio' ? '查看音频' : '查看视频')
  const cover = String(node.attrs?.cover || '').trim()
  return (
    <div key={key} style={mediaWrapperStyle(node)}>
      <a
        href={safeRichTextHref(src)}
        target="_blank"
        rel="noreferrer"
        className="my-4 flex w-full max-w-full items-center gap-3 rounded-lg border bg-muted/25 p-3 no-underline transition hover:bg-muted/40"
        style={mediaAttrs(node).style}
      >
        {cover ? (
          <img src={cover} alt="" className="m-0 h-14 w-20 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background text-xs font-medium text-muted-foreground">
            {kind === 'audio' ? '音频' : '视频'}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{src}</span>
        </span>
      </a>
    </div>
  )
}

function renderRichTextPlaceholder(node: RichTextNode, key: string) {
  const attrs = node.attrs || {}
  const status = String(attrs.status || 'pending')
  const title = String(attrs.title || attrs.kind || '素材生成').trim()
  const text = visiblePlaceholderText(attrs, status)
  const progress = normalizePlaceholderProgress(attrs.progress)
  const failed = status === 'failed'
  const succeeded = status === 'succeeded'

  return (
    <div
      key={key}
      className={cn(
        'my-4 rounded-lg border bg-muted/25 px-3 py-2',
        failed && 'border-destructive/30 bg-destructive/10',
        succeeded && 'border-emerald-500/25 bg-emerald-500/10'
      )}
    >
      <div className='mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground'>
        <span className='truncate'>
          {title || '素材生成'}
          {text ? `：${text}` : ''}
        </span>
        {progress != null ? (
          <span className='shrink-0 tabular-nums'>{progress}%</span>
        ) : null}
      </div>
      <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
        {progress != null ? (
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              failed ? 'bg-destructive' : succeeded ? 'bg-emerald-500' : 'bg-primary'
            )}
            style={{ width: `${progress}%` }}
          />
        ) : (
          <div className='h-full w-1/3 animate-pulse rounded-full bg-primary/75' />
        )}
      </div>
    </div>
  )
}

function visiblePlaceholderText(attrs: Record<string, unknown>, status: string) {
  const error = String(attrs.error || '').trim()
  if (error) {
    return error
  }
  const text = String(attrs.text || '').trim()
  if (!text) {
    return ''
  }
  if ((status === 'pending' || status === 'running') && isDefaultPlaceholderStatusText(text)) {
    return ''
  }
  return text
}

function isDefaultPlaceholderStatusText(text: string) {
  return (
    /^(图片|图像|视频|音频|文件|附件|素材)生成中，请稍后。?$/.test(text) ||
    text === '正在调用能力'
  )
}

function normalizePlaceholderProgress(value: unknown) {
  const progress = Number(value)
  if (!Number.isFinite(progress)) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function createRichTextOutline(
  doc: RichTextNode | null,
  enabled: boolean,
  minLevel: number,
  maxLevel: number,
  idPrefix: string
): RichTextOutline {
  if (!enabled || !doc || isEmptyRichTextDoc(doc)) {
    return EMPTY_RICH_TEXT_OUTLINE
  }

  const items: RichTextOutlineItem[] = []
  const headingIDs = new Map<string, string>()
  collectRichTextOutline(doc, 'doc', minLevel, maxLevel, idPrefix, items, headingIDs)
  return items.length > 0 ? { items, headingIDs } : EMPTY_RICH_TEXT_OUTLINE
}

function collectRichTextOutline(
  node: RichTextNode,
  key: string,
  minLevel: number,
  maxLevel: number,
  idPrefix: string,
  items: RichTextOutlineItem[],
  headingIDs: Map<string, string>
) {
  if (!Array.isArray(node.content)) {
    return
  }

  node.content.forEach((child, index) => {
    const childKey = `${key}-${index}`
    if (child.type === 'heading') {
      const level = headingLevel(child)
      const text = richTextNodePlainText(child).replace(/\s+/g, ' ').trim()
      if (level >= minLevel && level <= maxLevel && text) {
        const id = `${idPrefix}-${items.length + 1}`
        items.push({ id, level, text })
        headingIDs.set(childKey, id)
      }
    }
    collectRichTextOutline(child, childKey, minLevel, maxLevel, idPrefix, items, headingIDs)
  })
}

function richTextNodePlainText(node: RichTextNode): string {
  if (node.type === 'text') {
    return String(node.text || '')
  }
  if (node.type === 'hardBreak') {
    return ' '
  }
  return Array.isArray(node.content) ? node.content.map(richTextNodePlainText).join('') : ''
}

function normalizeHeadingLevel(value: unknown, fallback: number) {
  const level = Number(value)
  return Number.isFinite(level) ? Math.min(Math.max(Math.round(level), 1), 6) : fallback
}

function normalizeOutlineIDPrefix(value: unknown) {
  const prefix = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return prefix || 'rich-text-section'
}

function headingTag(node: RichTextNode) {
  return `h${headingLevel(node)}`
}

function headingLevel(node: RichTextNode) {
  return normalizeHeadingLevel(node.attrs?.level, 2)
}

function blockStyle(node: RichTextNode): CSSProperties | undefined {
  return richTextBlockStyleToCss(node.attrs || {}) as CSSProperties | undefined
}

function mediaAttrs(node: RichTextNode): {
  src: string
  style?: CSSProperties
} {
  const src = String(node.attrs?.src || '').trim()
  const maxWidth = normalizeRichTextMaxWidth(node.attrs?.maxWidth)
  const align = normalizeMediaAlign(node.attrs?.align)
  return {
    src,
    style: {
      ...(maxWidth ? { maxWidth } : {}),
      ...mediaAlignStyle(align),
    },
  }
}

function mediaWrapperStyle(node: RichTextNode): CSSProperties | undefined {
  const align = normalizeMediaAlign(node.attrs?.align)
  if (!align || align === 'left') {
    return undefined
  }
  return {
    display: 'flex',
    justifyContent: align === 'center' ? 'center' : 'flex-end',
  }
}

function normalizeMediaAlign(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  return text === 'center' || text === 'right' ? text : 'left'
}

function mediaAlignStyle(align: string): CSSProperties {
  if (align === 'center') {
    return { marginLeft: 'auto', marginRight: 'auto' }
  }
  if (align === 'right') {
    return { marginLeft: 'auto' }
  }
  return {}
}

function renderMediaCaption(caption: string) {
  return (
    <figcaption className={richTextMediaCaptionClassName}>
      {caption}
    </figcaption>
  )
}
